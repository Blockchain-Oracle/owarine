/**
 * The seat's side of the ticket products (C8c): its own tickets read AS its leased party, and its own choices on them,
 * each submitted with `actAs` = that party only, under the commandId the client journaled before sending
 * (`<intent>:<journal uuid>`), the way `writes.ts` does for legs. Accepts take the seat's cash (largest first); claims
 * pass the Window's `Resolution` as a disclosed contract, which is read as the venue, read-only, like every market
 * fact the seat routes need. Nothing is ever submitted as the venue from here.
 *
 *   accept   RangeQuote_Accept · ParlayQuote_Accept · BoostQuote_Accept · BoostExit_Accept · Supply_Accept · Withdraw_Accept
 *   claim    Round_Claim · Ticket_ClaimLeg · Boost_Claim (the owner's own settle, same rule as the venue's)
 *   refund   Round_RefundStale · Ticket_VoidStale · Boost_RefundStale (from refundAfter / voidAfter, no resolution needed)
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { LedgerError, type Command, type DisclosedContract, type JsTransaction, type LedgerClient, type Party } from "@agari/ledger";
import { diagnosis, type Diagnosis, type Signature } from "@agari/core/types";
import { decodeOpenPrint, decodeResolution, templateSuffix } from "../ops/canton/decode";
import * as tcmd from "../ops/tickets/commands";
import { decodeNavStatement, nextParlayLeg } from "../ops/tickets/decode";
import { createdEvents, SEAT_TICKET_TEMPLATES, ticketOutcome, toTicketSnapshot, type TicketSeatSnapshot, type WindowFacts } from "./tickets-read";
import { isTicketReserve, type TicketReserveId } from "../tickets/params";
import type { TicketProduct, TicketsMine, TicketWriteReply } from "../provider/ticket-wire";
import { appMarketId, seatCommandId, type SeatIntent } from "./ids";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";
import { DEFAULT_COMMAND_DEADLINE_MS, selectCash, type CommandJournal, type CommandRow } from "./writes";

export interface TicketSeatConfig {
  client: LedgerClient;
  venueParty: Party;
  journal: CommandJournal;
  /** The venue ladder's fair YES ticks by terms id, for a boost's live mark; none = no mark. */
  fairTicks?: () => Promise<ReadonlyMap<string, number>>;
  now?: () => number;
}

const FACTS_CACHE_MS = 3_000;

const sideOf = (s: "SideUp" | "SideDown"): "up" | "down" => (s === "SideUp" ? "up" : "down");



export function createTicketSeat(cfg: TicketSeatConfig) {
  const { client, journal } = cfg;
  const now = cfg.now ?? Date.now;
  let facts: { at: number; value: Promise<{ resolutions: Map<string, WindowFacts>; opens: Map<string, bigint> }> } | null = null;

  async function read(party: Party): Promise<TicketSeatSnapshot> {
    const r = await client.activeContracts({ parties: [party], templateIds: [...SEAT_TICKET_TEMPLATES] });
    return toTicketSnapshot(party, r.contracts.map((c) => c.createdEvent), r.activeAtOffset);
  }

  /** Every Window's Resolution (with its disclosure) and live opening print, read as the venue, read-only. */
  function windowFacts() {
    if (facts && now() - facts.at < FACTS_CACHE_MS) return facts.value;
    const value = client.activeContracts({ parties: [cfg.venueParty], templateIds: [TEMPLATE_IDS.Resolution, TEMPLATE_IDS.OpenPrint], includeCreatedEventBlob: true }).then((r) => {
      const resolutions = new Map<string, WindowFacts>();
      const opens = new Map<string, bigint>();
      for (const c of r.contracts) {
        const e = c.createdEvent;
        if (templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.Resolution)) {
          const x = decodeResolution(e.createArgument);
          resolutions.set(x.termsCid, {
            resolutionCid: e.contractId, outcome: x.outcome, openE8: x.openPriceE8, closeE8: x.closePriceE8,
            disclosure: e.createdEventBlob ? { createdEventBlob: e.createdEventBlob, templateId: e.templateId, contractId: e.contractId, synchronizerId: c.synchronizerId } : null,
          });
        } else if (templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.OpenPrint)) {
          const o = decodeOpenPrint(e.createArgument);
          opens.set(o.termsCid, o.openPriceE8);
        }
      }
      return { resolutions, opens };
    });
    const entry = { at: now(), value };
    facts = entry;
    value.catch(() => facts === entry && (facts = null));
    return value;
  }

  async function mine(party: Party): Promise<{ value: TicketsMine; offset: number; busyUntilMs: number }> {
    const [snap, f, fair] = await Promise.all([read(party), windowFacts(), cfg.fairTicks ? cfg.fairTicks().catch(() => new Map<string, number>()) : Promise.resolve(new Map<string, number>())]);
    const rounds = snap.rounds.map(({ cid, data: r }) => {
      const res = f.resolutions.get(r.termsCid);
      return {
        cid, marketId: appMarketId(r.marketId), kind: r.kind === "Moonshot" ? ("moonshot" as const) : ("range" as const), side: r.side === "Inside" ? ("inside" as const) : ("outside" as const),
        lowE8: r.lowE8, highE8: r.highE8, stakeBase: r.stake, maxPayoutBase: r.maxPayout, expirySec: r.expirySec, refundAfterSec: r.refundAfterSec,
        openingPrint: res?.openE8 ?? f.opens.get(r.termsCid) ?? null,
        resolution: res ? { closeE8: res.closeE8, void: res.outcome === null } : null,
      };
    });
    const parlays = snap.tickets.map(({ cid, data: t }) => {
      const next = nextParlayLeg(t.legs);
      return {
        cid, stakeBase: t.stake, maxPayoutBase: t.maxPayout, voidAfterSec: t.voidAfterSec,
        legs: t.legs.map((l, i) => {
          const res = f.resolutions.get(l.termsCid);
          const resolved = l.won ? ("won" as const) : !res || i !== next ? ("pending" as const) : res.outcome === null ? ("void" as const) : res.outcome === l.side ? ("won" as const) : ("lost" as const);
          return { marketId: appMarketId(l.marketId), side: sideOf(l.side), expirySec: l.expirySec, won: l.won, resolved };
        }),
      };
    });
    const positions = snap.positions.map(({ cid, data: p }) => {
      const res = f.resolutions.get(p.termsCid);
      const ticks = fair.get(p.termsCid);
      const sideTicks = ticks === undefined ? null : p.side === "SideUp" ? ticks : 1000 - ticks;
      return {
        cid, marketId: appMarketId(p.marketId), side: sideOf(p.side), leverageBps: p.leverageBps, priceTicks: p.priceTicks, lots: p.lots, cashUnit: p.cashUnit,
        stakeBase: p.stake, frontedBase: p.fronted, premiumBase: p.premium, barrierE8: p.barrierE8, knockOutProceedsBase: p.knockOutProceeds,
        expirySec: p.expirySec, refundAfterSec: p.refundAfterSec,
        resolved: !res ? ("pending" as const) : res.outcome === null ? ("void" as const) : res.outcome === "SideUp" ? ("up" as const) : ("down" as const),
        markBase: sideTicks === null ? null : p.lots * BigInt(sideTicks) * p.cashUnit,
      };
    });
    const byReserve = new Map<TicketReserveId, bigint>();
    for (const { data: l } of snap.lpShares) if (isTicketReserve(l.reserveId)) byReserve.set(l.reserveId, (byReserve.get(l.reserveId) ?? 0n) + l.shares);
    const navs = byReserve.size ? await statements() : new Map<string, { assets: bigint; shares: bigint }>();
    const shares = [...byReserve].map(([reserveId, n]) => {
      const nav = navs.get(reserveId);
      return { reserveId, shares: n, worthBase: nav && nav.shares > 0n ? (n * nav.assets) / nav.shares : 0n };
    });
    const deadlines = [...snap.rounds.map((r) => r.data.refundAfterSec), ...snap.tickets.map((t) => t.data.voidAfterSec), ...snap.positions.map((p) => p.data.refundAfterSec)];
    return { value: { rounds, parlays, positions, shares }, offset: snap.offset, busyUntilMs: deadlines.length ? Math.max(...deadlines) * 1000 : 0 };
  }

  /** The live statement of each ticket reserve (venue-signed, auditor-visible), read as the venue. */
  async function statements(): Promise<Map<string, { assets: bigint; shares: bigint }>> {
    const r = await client.activeContracts({ parties: [cfg.venueParty], templateIds: [TEMPLATE_IDS.NavStatement] });
    const out = new Map<string, { assets: bigint; shares: bigint; seq: number }>();
    for (const c of r.contracts) {
      const n = decodeNavStatement(c.createdEvent.createArgument);
      const had = out.get(n.reserveId);
      if (!had || n.seq > had.seq) out.set(n.reserveId, { assets: n.assets, shares: n.shares, seq: n.seq });
    }
    return out;
  }

  async function owned(commandId: string, actor: { party: Party; leaseId: string }): Promise<CommandRow | null> {
    const row = await journal.get(commandId);
    if (row && (row.party !== actor.party || row.leaseId !== actor.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
    return row;
  }

  async function landedTx(row: CommandRow | null, party: Party): Promise<JsTransaction | null> {
    if (!row) return null;
    let updateId = row.updateId;
    if (!updateId) updateId = (await client.findAcceptedCompletion(row.commandId, [party], row.beginOffset))?.updateId ?? null;
    if (!updateId) return null;
    const tx = await client.updateById(updateId, { transactionShape: "TRANSACTION_SHAPE_ACS_DELTA", eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: {} } } }] } }, verbose: true } });
    if (tx && row.state !== "landed") await journal.finish(row.commandId, { state: "landed", updateId });
    return tx ?? null;
  }

  const confirmed = (tx: JsTransaction, party: Party, recovered: boolean): TicketWriteReply => ({ kind: "confirmed", updateId: tx.updateId as Signature, ...ticketOutcome(tx, party), recovered });

  interface Plan {
    commands: Command[];
    disclosed?: DisclosedContract[];
    deadlineMs: number;
    ctx: RejectionContext;
    /** Called once with a fresh read when the first submit found the seat's cash spent (another tab). */
    retryWith?: (snap: TicketSeatSnapshot) => Command[];
  }

  /** One seat command, journaled first, recovered by its id: the shape `writes.ts` gives accepts and claims. */
  async function runCommand(actor: { party: Party; leaseId: string }, intent: SeatIntent, journalId: string, plan: (snap: TicketSeatSnapshot) => Plan | Promise<Plan>): Promise<TicketWriteReply> {
    const commandId = seatCommandId(intent, journalId);
    let ctx: RejectionContext = { step: intent === "agent" ? "accept" : intent };
    try {
      const prior = await owned(commandId, actor);
      const earlier = prior?.state === "landed" || prior?.state === "unknown" ? await landedTx(prior, actor.party) : null;
      if (earlier) return confirmed(earlier, actor.party, true);
      const snap = await read(actor.party);
      let p: Plan;
      try {
        p = await plan(snap);
      } catch (error) {
        // The quote or ticket is gone: if this very command landed before, answer with it.
        const landed = await landedTx(prior, actor.party);
        if (landed) return confirmed(landed, actor.party, true);
        throw error;
      }
      ctx = p.ctx;
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: intent, beginOffset: snap.offset, deadlineMs: p.deadlineMs }, now());
      const send = async (commands: Command[]) => {
        try {
          const r = await client.submitAndWaitForTransaction({ actAs: [actor.party], commandId, commands, ...(p.disclosed?.length ? { disclosedContracts: p.disclosed } : {}) });
          return { ok: true as const, tx: r.transaction, recovered: r.recovered };
        } catch (error) {
          return { ok: false as const, error, diagnosis: classifyRejection(error, p.ctx) };
        }
      };
      let result = await send(p.commands);
      if (!result.ok && p.retryWith && result.diagnosis.kind === "insufficient-collateral" && result.error instanceof LedgerError && result.error.kind === "not-found") {
        result = await send(p.retryWith(await read(actor.party)));
      }
      if (!result.ok) {
        if (result.diagnosis.kind === "order-expired" || result.diagnosis.kind === "already-claimed") {
          const landed = await landedTx(row, actor.party);
          if (landed) return confirmed(landed, actor.party, true);
        }
        const state = result.diagnosis.kind === "send-unknown" ? "unknown" : "failed";
        await journal.finish(commandId, { state, diagnosis: result.diagnosis });
        return state === "unknown" ? { kind: "unknown", diagnosis: result.diagnosis } : { kind: "refused", diagnosis: result.diagnosis };
      }
      await journal.finish(commandId, { state: "landed", updateId: result.tx.updateId });
      return confirmed(result.tx, actor.party, result.recovered);
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d: Diagnosis = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  const payWith = (cash: TicketSeatSnapshot["cash"], cost: bigint): string[] => {
    const picked = selectCash(cash, cost);
    if (!picked) throw refuse("insufficient-collateral", `the seat holds ${cash.reduce((s, c) => s + c.amount, 0n)} and this costs ${cost}`);
    return picked;
  };

  /** The seat takes a quote the venue issued it: a ticket, a boost exit, or a liquidity quote. */
  function accept(actor: { party: Party; leaseId: string }, product: TicketProduct, o: { journalId: string; quoteCid: string }): Promise<TicketWriteReply> {
    return runCommand(actor, "accept", o.journalId, (snap) => {
      const gone = () => refuse("order-expired", "the quote is no longer open for this seat (accepted, expired or withdrawn)");
      const live = (validUntilSec: number) => {
        if (validUntilSec * 1000 <= now()) throw refuse("order-expired", `the quote expired at ${new Date(validUntilSec * 1000).toISOString()}`);
        return validUntilSec * 1000;
      };
      const paid = (cid: string, cost: bigint, build: (cid: string, cash: string[]) => Command, deadlineMs: number): Plan => {
        const cashCids = payWith(snap.cash, cost);
        return {
          commands: [build(cid, cashCids)], deadlineMs, ctx: { step: "accept", quoteCid: cid, cashCids },
          retryWith: (fresh) => [build(cid, payWith(fresh.cash, cost))],
        };
      };
      const cid = o.quoteCid;
      if (product === "range") {
        const q = snap.rangeQuotes.find((x) => x.cid === cid);
        if (!q) throw gone();
        return paid(cid, q.data.stake, tcmd.acceptRangeQuote, live(q.data.validUntilSec));
      }
      if (product === "parlay") {
        const q = snap.parlayQuotes.find((x) => x.cid === cid);
        if (!q) throw gone();
        return paid(cid, q.data.stake, tcmd.acceptParlayQuote, live(q.data.validUntilSec));
      }
      if (product === "boost") {
        const q = snap.boostQuotes.find((x) => x.cid === cid);
        if (q) return paid(cid, q.data.stake, tcmd.acceptBoostQuote, live(q.data.validUntilSec));
        const exit = snap.exitQuotes.find((x) => x.cid === cid);
        if (!exit) throw gone();
        return { commands: [tcmd.acceptBoostExit(cid)], deadlineMs: live(exit.data.validUntilSec), ctx: { step: "sell", buyQuoteCids: [cid], legCids: [exit.data.positionCid] } };
      }
      const supply = snap.supplyQuotes.find((x) => x.cid === cid);
      if (supply) return paid(cid, supply.data.cashIn, tcmd.acceptSupply, live(supply.data.validUntilSec));
      const withdraw = snap.withdrawQuotes.find((x) => x.cid === cid);
      if (!withdraw) throw gone();
      return { commands: [tcmd.acceptWithdraw(cid)], deadlineMs: live(withdraw.data.validUntilSec), ctx: { step: "accept", quoteCid: cid } };
    });
  }

  /**
   * The owner's own exit from a ticket: `claim` against the Window's Resolution (disclosed), or `refund` (the stale
   * refund / void) once its deadline has passed with no resolution. A claim with no resolution yet falls back to the
   * refund when that deadline has passed, as the legs' claim does.
   */
  function exit(actor: { party: Party; leaseId: string }, product: Exclude<TicketProduct, "earn">, mode: "claim" | "refund", o: { journalId: string; ticketCid: string }): Promise<TicketWriteReply> {
    return runCommand(actor, mode, o.journalId, async (snap) => {
      const nowSec = Math.floor(now() / 1000);
      const f = await windowFacts();
      const gone = () => refuse("already-claimed", "the seat holds no such ticket (settled, claimed or refunded)");
      const withRes = (termsCid: string, deadlineSec: number, claim: (res: string) => Command, refund: () => Command, ticketCid: string): Plan => {
        const res = f.resolutions.get(termsCid);
        if (mode === "claim" && res) {
          if (!res.disclosure) throw new Error("resolution read without its created-event blob");
          return { commands: [claim(res.resolutionCid)], disclosed: [res.disclosure], deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS, ctx: { step: "claim", legCids: [ticketCid], resolutionCids: [res.resolutionCid] } };
        }
        if (nowSec < deadlineSec) throw refuse("not-settled", mode === "claim" ? "the Window has no resolution yet" : `the refund opens at ${new Date(deadlineSec * 1000).toISOString()}`);
        return { commands: [refund()], deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS, ctx: { step: "refund", legCids: [ticketCid] } };
      };
      const cid = o.ticketCid;
      if (product === "range") {
        const r = snap.rounds.find((x) => x.cid === cid);
        if (!r) throw gone();
        return withRes(r.data.termsCid, r.data.refundAfterSec, (res) => tcmd.claimRound(cid, res), () => tcmd.refundRound(cid), cid);
      }
      if (product === "boost") {
        const p = snap.positions.find((x) => x.cid === cid);
        if (!p) throw gone();
        return withRes(p.data.termsCid, p.data.refundAfterSec, (res) => tcmd.claimBoost(cid, res), () => tcmd.refundBoost(cid), cid);
      }
      const t = snap.tickets.find((x) => x.cid === cid);
      if (!t) throw gone();
      const i = nextParlayLeg(t.data.legs);
      if (i === null) throw gone();
      return withRes(t.data.legs[i]!.termsCid, t.data.voidAfterSec, (res) => tcmd.claimParlayLeg(cid, res), () => tcmd.voidParlayStale(cid), cid);
    });
  }

  /** Before a withdrawal: the seat's shares of one reserve merged into one contract (its own `LpShare_Merge`). */
  async function mergeShares(actor: { party: Party; leaseId: string }, reserve: TicketReserveId): Promise<void> {
    const snap = await read(actor.party);
    const mine = snap.lpShares.filter((s) => s.data.reserveId === reserve);
    if (mine.length < 2) return;
    const [head, ...rest] = mine;
    // `LpShare_Merge` consumes the share it is exercised on, so each merge runs on the one the last created.
    let cur = head!.cid;
    for (const other of rest) {
      const r = await client.submitAndWaitForTransaction({ actAs: [actor.party], commandId: `lpmerge:${actor.leaseId}:${other.cid.slice(0, 40)}`, commands: [tcmd.mergeLpShares(cur, other.cid)] });
      cur = createdEvents(r.transaction).find((e) => templateSuffix(e.templateId) === templateSuffix(TEMPLATE_IDS.LpShare))?.contractId ?? cur;
    }
  }

  return { read, mine, accept, exit, mergeShares, windowFacts, statements };
}

export type TicketSeat = ReturnType<typeof createTicketSeat>;

export const ticketRefusal = (kind: Diagnosis["kind"], technical: string): TicketWriteReply => ({ kind: "refused", diagnosis: diagnosis(kind, technical) });
