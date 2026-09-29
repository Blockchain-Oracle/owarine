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
 * Legs on resolved markets are the settler's. The web recycles the seat once the ledger shows no open leg and no live
 * quote, and withdraws its leftover cash itself. Draining seats come from the web's `seat_pool` table (read-only), or
 * from `SEAT_DRAIN_PARTIES` on a local run.
 */
import { getDb } from "@agari/db";
import { TEMPLATE_IDS } from "@agari/daml";
import {
  closeOutCommandId, cmd, decodeLeg, decodeQuote, failureText, isInactive, pick, readActive, submit, withdrawCommandId, type RoleSession,
} from "@agari/markets/ops/canton";
import { AGENT_TEMPLATE_IDS } from "@agari/daml";
import { acmd, decodeDeskMandate } from "@agari/markets/ops/agents";
import { readAgentsAs } from "@agari/markets/server";
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

export function startSeatDrain(input: {
  venue: RoleSession;
  pool: ShardPool | null;
  log: (why: string) => void;
  seats?: () => Promise<string[]>;
  /** Kept equal to the draining set each pass, so the issuer stops quoting to those seats. */
  draining?: Set<string>;
}): { stop: () => void } {
  const seats = input.seats ?? (() => drainingSeats());
  const counters = { closedOut: 0, withdrawn: 0, failed: 0, agentsEnded: 0 };
  const pass = async (): Promise<PassResult> => {
    const draining = new Set(await seats());
    if (input.draining) {
      input.draining.clear();
      for (const p of draining) input.draining.add(p);
    }
    if (draining.size === 0) return { why: `no seat draining; closed out ${counters.closedOut}, withdrew ${counters.withdrawn}` };
    const acs = await readActive(input.venue, [TEMPLATE_IDS.Leg, TEMPLATE_IDS.Quote, TEMPLATE_IDS.Resolution]);
    const resolved = new Set(acs.filter((c) => c.createdEvent.templateId.endsWith(":PM.Market:Resolution")).map((c) => (c.createdEvent.createArgument as { termsCid: string }).termsCid));
    const legs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => draining.has(l.data.owner) && !resolved.has(l.data.termsCid));
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
    for (const seat of draining) {
      try {
        counters.agentsEnded += await endAgents(input.venue, seat, notes);
      } catch (error) {
        counters.failed++;
        notes.push(`agents of ${seat.split("::")[0]} not ended: ${failureText(error)}`);
      }
    }
    for (const n of notes) input.log(n);
    return { why: `${draining.size} seats draining: ${legs.length} legs to close out, ${quotes.length} quotes to withdraw; closed out ${counters.closedOut}, withdrew ${counters.withdrawn}, failed ${counters.failed}`, detail: { ...counters } };
  };
  return runActor({ name: "seat-drain", log: input.log, dryRun: input.venue.dryRun, everyMs: 15_000, pass });
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
