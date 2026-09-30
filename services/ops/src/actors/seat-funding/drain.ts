/**
 * Seat close-out (plan §4 "Seats": `leased → draining → free`). For every seat the web marked `draining`, ops
 *
 *   - withdraws its live quotes (`Quote_Withdraw`, `withdraw:<quoteCid>`; the venue stake returns to the pool), and
 *   - closes out each open leg on a market not yet resolved with the two-controller `Leg_CloseOut` (venue and seat),
 *     re-backed from a pool shard (`closeout:<legCid>`): the seat gets backing plus fee back, the venue takes the leg.
 *
 *   - (C8f) ends its agents, as the seat's own choices: revokes each `AgentGrant` it opened (the budget returns to its
 *     cash), ends each consent (`Subscriber_Unsubscribe`) and closes its desk (`Mandate_Close`, the budget returns),
 *     so no later lessee of this party inherits a grant, a consent or a desk (`drain-agent:<cid>`).
 *
 *   - (C9d) exits each leg past its `refundAfter` as the seat's own choice: `Leg_Claim` against the Window's
 *     resolution (disclosed) when there is one, else `Leg_RefundStale`. Past that deadline the venue can no longer
 *     settle it (`Leg_Settle` is deadline-bound), so without this a seat whose visitor left would hold the leg forever
 *     (seen live when the host slept through a settlement window), and
 *   - (C9d) redeems its Earn shares through the Earn desk (a withdraw quote the seat accepts), and
 *   - (C9d) recycles it: once the ledger, read as the seat, shows it holds nothing (`readSeatHoldings`: no leg, live
 *     quote, ticket, Earn share, duel or agent grant), it withdraws the seat's leftover cash as the seat's own choice
 *     and sets its `seat_pool` row back to `free`, under that row's lock (`@agari/db` `recycleDrainingSeat`). Before
 *     C9d only the web's lease route recycled, and only when the pool was already full, so empty seats sat `draining`.
 *
 * Legs on resolved markets are the settler's, open tickets the ticket keeper's, duels the duel settler's: the seat waits
 * for them. Draining seats come from the web's `seat_pool` table, or from `SEAT_DRAIN_PARTIES` on a local run (those
 * have no row, so they are drained but never recycled).
 */
import { createHash } from "node:crypto";
import { getDb, recycleDrainingSeat, type Db, type RecycleOutcome } from "@agari/db";
import { TEMPLATE_IDS } from "@agari/daml";
import {
  closeOutCommandId, cmd, decodeLeg, decodeQuote, failureText, isInactive, pick, readActive, submit, withdrawCommandId, type RoleSession,
} from "@agari/markets/ops/canton";
import { AGENT_TEMPLATE_IDS } from "@agari/daml";
import { acmd, decodeDeskMandate } from "@agari/markets/ops/agents";
import { holdingsText, isSeatEmpty, readAgentsAs, readSeatHoldings, type SeatHoldings } from "@agari/markets/server";
import { runActor, type PassResult } from "../../runtime/actor";
import type { ShardPool } from "../quote-issuer/pool";
import { submitWithShards, venueCashCreated } from "../quote-issuer/pooled-submit";

/** The seats in `draining`, from the web's seat table; an absent table or database reads as none. */
export async function drainingSeats(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const fromEnv = (env.SEAT_DRAIN_PARTIES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const db = getDb();
  if (!db) return fromEnv;
  try {
    const rows = await db<{ party: string }[]>`SELECT party FROM seat_pool WHERE state = 'draining' LIMIT 50`;
    return [...new Set([...fromEnv, ...rows.map((r) => r.party)])];
  } catch {
    return fromEnv;
  }
}

/** Redeems one seat's Earn shares (the ticket desk's withdraw quote, accepted as the seat); returns notes. */
export type RedeemShares = (seat: string, shares: SeatHoldings["lpShares"]) => Promise<string[]>;

/** `drain-sweep:<hash>`: one recycle sweep of a seat's cash, deterministic per cash set so a retry lands once. */
export const sweepCommandId = (seat: string, cash: readonly string[]): string =>
  `drain-sweep:${createHash("sha256").update(seat).update([...cash].sort().join(",")).digest("hex").slice(0, 40)}`;

/**
 * The recycle check for one seat, as the seat: holdings first; an empty seat's cash is withdrawn in one command, then it
 * may be freed. Exported for the unit test with a fake client.
 */
export async function recycleCheck(venue: RoleSession, seat: string, nowMs: number, redeem?: RedeemShares, notes: string[] = []): Promise<{ free: true } | { free: false; why: string }> {
  const held = await readSeatHoldings(venue.client, seat, nowMs);
  if (held.lpShares.length > 0 && redeem) notes.push(...(await redeem(seat, held.lpShares)));
  if (!isSeatEmpty(held)) return { free: false, why: holdingsText(held) };
  if (held.cash.length > 0) {
    if (venue.dryRun) return { free: false, why: "DRY RUN: the cash sweep was not executed" };
    await venue.client.submitAndWaitForTransaction({
      actAs: [seat],
      commandId: sweepCommandId(seat, held.cash),
      commands: held.cash.map((cid) => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.VenueCash, contractId: cid, choice: "VenueCash_Withdraw", choiceArgument: {} } })),
    });
  }
  return { free: true };
}

export interface SeatDrainInput {
  venue: RoleSession;
  pool: ShardPool | null;
  log: (why: string) => void;
  seats?: () => Promise<string[]>;
  /** Kept equal to the draining set each pass, so the issuer stops quoting to those seats. */
  draining?: Set<string>;
  /** The seat pool's database; null leaves recycling to the web (a local run with `SEAT_DRAIN_PARTIES`). */
  db?: Db | null;
  /** Late-bound: the ticket desk starts after the drain. */
  redeemShares?: () => RedeemShares | null;
  /** Injected in tests. */
  recycle?: (party: string, nowMs: number, work: () => Promise<{ free: true } | { free: false; why: string }>) => Promise<RecycleOutcome>;
}

export function startSeatDrain(input: SeatDrainInput): { stop: () => void } {
  return runActor({ name: "seat-drain", log: input.log, dryRun: input.venue.dryRun, everyMs: 15_000, pass: createSeatDrainPass(input) });
}

/** One drain pass (withdraw, close out, end agents, redeem shares, recycle), exported for the unit test. */
export function createSeatDrainPass(input: SeatDrainInput): () => Promise<PassResult> {
  const seats = input.seats ?? (() => drainingSeats());
  const counters = { closedOut: 0, withdrawn: 0, failed: 0, agentsEnded: 0, freed: 0, exited: 0 };
  const db = input.db === undefined ? getDb() : input.db;
  const recycle = input.recycle ?? (db ? (party: string, nowMs: number, work: Parameters<typeof recycleDrainingSeat>[3]) => recycleDrainingSeat(db, party, nowMs, work) : null);
  const pass = async (): Promise<PassResult> => {
    const draining = new Set(await seats());
    if (input.draining) {
      input.draining.clear();
      for (const p of draining) input.draining.add(p);
    }
    if (draining.size === 0) return { why: `no seat draining; closed out ${counters.closedOut}, withdrew ${counters.withdrawn}, freed ${counters.freed}` };
    const acs = await readActive(input.venue, [TEMPLATE_IDS.Leg, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Resolution], { blobs: true });
    const resolutions = new Map(acs.filter((c) => c.createdEvent.templateId.endsWith(":PM.Market:Resolution")).map((c) => [(c.createdEvent.createArgument as { termsCid: string }).termsCid, c] as const));
    const nowSec = Math.floor(Date.now() / 1000);
    const seatLegs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => draining.has(l.data.owner));
    const stale = seatLegs.filter((l) => l.data.refundAfterSec <= nowSec);
    const legs = seatLegs.filter((l) => l.data.refundAfterSec > nowSec && !resolutions.has(l.data.termsCid));
    const quotes = pick(acs, TEMPLATE_IDS.Quote, decodeQuote).filter((q) => draining.has(q.data.user));
    const notes: string[] = [];
    for (const q of quotes) {
      try {
        const out = await submit(input.venue, { commandId: withdrawCommandId(q.cid), commands: [cmd.withdrawQuote(q.cid, "seat draining")] });
        if (out.kind === "done") {
          counters.withdrawn++;
          input.pool?.complete([], new Set(), venueCashCreated(out));
        }
      } catch (error) {
        if (!isInactive(error)) notes.push(`withdraw ${q.data.marketId} failed: ${failureText(error)}`);
      }
    }
    for (const l of legs) {
      if (!input.pool) break;
      try {
        const lease = await input.pool.lease(l.data.backingShare, `close-out ${l.data.marketId}`);
        const out = await submitWithShards(input.pool, input.venue, [lease], { commandId: closeOutCommandId(l.cid), commands: [cmd.closeOutLeg(l.cid, lease.cid)], alsoActAs: [l.data.owner] });
        if (out.kind === "done") {
          counters.closedOut++;
          notes.push(`closed out ${l.data.marketId} ${l.data.outcome} ${l.data.lots} lots of ${l.data.owner.split("::")[0]} at cost`);
        }
      } catch (error) {
        if (isInactive(error)) continue;
        counters.failed++;
        notes.push(`close-out ${l.data.marketId} failed: ${failureText(error)}`);
      }
    }
    for (const l of stale) {
      const res = resolutions.get(l.data.termsCid);
      const blob = res?.createdEvent.createdEventBlob;
      const command = res && blob
        ? { ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: l.cid, choice: "Leg_Claim", choiceArgument: { resolutionCid: res.createdEvent.contractId } } }
        : { ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: l.cid, choice: "Leg_RefundStale", choiceArgument: {} } };
      if (input.venue.dryRun) {
        notes.push(`DRY: would have exited ${l.data.marketId} for ${l.data.owner.split("::")[0]}`);
        continue;
      }
      try {
        await input.venue.client.submitAndWaitForTransaction({
          actAs: [l.data.owner],
          commandId: `drain-exit:${l.cid.slice(0, 48)}`,
          commands: [command],
          ...(res && blob ? { disclosedContracts: [{ createdEventBlob: blob, templateId: res.createdEvent.templateId, contractId: res.createdEvent.contractId, synchronizerId: res.synchronizerId }] } : {}),
        });
        counters.exited++;
        notes.push(`${l.data.owner.split("::")[0]}: ${res && blob ? "claimed" : "refunded"} its stale ${l.data.marketId} leg (past refundAfter, the venue can no longer settle it)`);
      } catch (error) {
        if (isInactive(error)) continue;
        counters.failed++;
        notes.push(`exit of stale ${l.data.marketId} failed: ${failureText(error)}`);
      }
    }
    for (const seat of draining) {
      try {
        counters.agentsEnded += await endAgents(input.venue, seat, notes);
      } catch (error) {
        counters.failed++;
        notes.push(`agents of ${seat.split("::")[0]} not ended: ${failureText(error)}`);
      }
    }
    const held: string[] = [];
    if (recycle) {
      for (const seat of draining) {
        try {
          const out = await recycle(seat, Date.now(), () => recycleCheck(input.venue, seat, Date.now(), input.redeemShares?.() ?? undefined, notes));
          if (out.kind === "freed") {
            counters.freed++;
            draining.delete(seat);
            input.draining?.delete(seat);
            notes.push(`${seat.split("::")[0]}: holds nothing, cash withdrawn, seat free`);
          } else if (out.kind === "held") held.push(`${seat.split("::")[0]} holds ${out.why}`);
        } catch (error) {
          counters.failed++;
          notes.push(`recycle of ${seat.split("::")[0]} failed: ${failureText(error)}`);
        }
      }
    }
    for (const n of notes) input.log(n);
    return {
      why: `${draining.size} seats draining${held.length ? ` (${held.join("; ")})` : ""}: ${legs.length} legs to close out, ${quotes.length} quotes to withdraw; closed out ${counters.closedOut}, withdrew ${counters.withdrawn}, freed ${counters.freed}, failed ${counters.failed}`,
      detail: { ...counters },
    };
  };
  return pass;
}

/**
 * The seat's grants, consents and desk, ended by the seat's own choices (the venue's process may act as any party of
 * its account, the same authority `Leg_CloseOut` uses for the seat half). Each under its own deterministic command id.
 */
async function endAgents(venue: RoleSession, seat: string, notes: string[]): Promise<number> {
  const snap = await readAgentsAs(venue.client, seat);
  const desks = await venue.client.activeContracts({ parties: [seat], templateIds: [AGENT_TEMPLATE_IDS.DeskMandate] });
  const jobs: Array<{ id: string; command: ReturnType<typeof acmd.revokeGrant>; what: string }> = [];
  for (const g of snap.grants.filter((x) => x.data.owner === seat)) jobs.push({ id: `drain-agent:${g.cid.slice(0, 48)}`, command: acmd.revokeGrant(g.cid), what: `revoked a grant to ${g.data.agent.split("::")[0]} (${g.data.budget} back)` });
  const book = snap.books[0];
  if (book) {
    // Each unsubscribe re-creates the book, so one per pass is exercised on the live book; the next pass does the next.
    const sub = snap.subscriptions.find((x) => x.data.subscriber === seat);
    if (sub) jobs.push({ id: `drain-agent:${sub.cid.slice(0, 48)}`, command: acmd.unsubscribe(book.cid, sub.cid), what: `ended a consent to ${sub.data.strategyId}` });
  }
  for (const c of desks.contracts) {
    try {
      const m = decodeDeskMandate(c.createdEvent.createArgument);
      if (m.owner === seat) jobs.push({ id: `drain-agent:${c.createdEvent.contractId.slice(0, 48)}`, command: acmd.closeDesk(c.createdEvent.contractId), what: `closed its desk (${m.grant.budget} back)` });
    } catch {
      // not ours to close
    }
  }
  let ended = 0;
  for (const job of jobs) {
    if (venue.dryRun) {
      notes.push(`DRY: would have ${job.what} for ${seat.split("::")[0]}`);
      continue;
    }
    try {
      await venue.client.submitAndWaitForTransaction({ actAs: [seat], commandId: job.id, commands: [job.command] });
      ended++;
      notes.push(`${seat.split("::")[0]}: ${job.what}`);
    } catch (error) {
      if (!isInactive(error)) throw error;
    }
  }
  return ended;
}
