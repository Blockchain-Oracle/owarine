/**
 * Range and Moonshot writes on Canton (C8c), through the ticket lane (`submitter/ticket-lane.ts`): the open is a firm
 * `RangeQuote` from ops at the payout the seat confirmed (a requote, nothing issued, when the fresh stake is above its
 * cap), then the seat's own `RangeQuote_Accept`. Settle and claim are the owner's `Round_Claim` against the Window's
 * resolution; the stale void is `Round_RefundStale`. Supply and withdraw go to the range reserve's Earn quotes.
 */
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import type { RangeIntent } from "@agari/core/range";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import type { SeatLaneDeps } from "../submitter/seat-lane";
import { acceptTicketQuote, asTxOutcome, exitTicket } from "../submitter/ticket-lane";
import { rangeCall, rememberTicket, ticketCidOf } from "../tickets/client";
import { earnWrite } from "../tickets/earn-lane";
import type { RangeOpenOutcome } from "./read";

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });

export async function rangeOpenLane(deps: SeatLaneDeps, intent: Extract<RangeIntent, { kind: "range-open" }>, onPhase?: PhaseListener): Promise<RangeOpenOutcome> {
  const moonshot = intent.highPrint >= intent.lowPrint * 3n || intent.lowPrint <= 1n;
  const issued = await rangeCall({
    op: "issue", marketId: intent.marketId, side: intent.side, lowE8: intent.lowPrint, highE8: intent.highPrint,
    maxPayoutBase: intent.maxPayoutBase, maxStakeBase: intent.maxStakeBase, moonshot,
  });
  if (!issued.ok) return refused(issued.diagnosis);
  const q = issued.value;
  if (q.kind === "refused") return refused(q.diagnosis);
  if (q.kind === "requote") return { status: "requote", stakeBase: q.stakeBase, maxPayoutBase: q.maxPayoutBase };
  if (q.kind !== "quote") return refused(diagnosis("unknown", `unexpected ${q.kind} reply to a range issue`));
  const w = await acceptTicketQuote(deps, "range", q.quoteCid, { kind: "range-open", summary: `${intent.side} ${intent.lowPrint}–${intent.highPrint} for ${q.maxPayoutBase}`, marketId: intent.marketId }, q.validUntilMs, onPhase);
  if (w.status !== "confirmed") return w;
  return { status: "confirmed", txHash: w.txHash, roundId: w.ticketCid ? rememberTicket("range", w.ticketCid) : 0n, stakeBase: q.stakeBase };
}

export async function rangeTxLane(deps: SeatLaneDeps, intent: RangeIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  switch (intent.kind) {
    case "range-open": {
      const o = await rangeOpenLane(deps, intent, onPhase);
      return o.status === "requote" ? refused(diagnosis("requote", `the stake for this payout is now ${o.stakeBase}`)) : o.status === "confirmed" ? { status: "confirmed", txHash: o.txHash } : o;
    }
    case "range-settle":
    case "range-claim":
    case "range-void-stale": {
      const cid = await ticketCidOf("range", intent.roundId);
      if (!cid) return refused(diagnosis("already-claimed", "this seat holds no such round (settled, claimed or refunded)"));
      const mode = intent.kind === "range-void-stale" ? "refund" : "claim";
      return asTxOutcome(await exitTicket(deps, "range", mode, cid, { kind: intent.kind, summary: `${mode} round ${intent.roundId}` }, onPhase));
    }
    case "range-supply":
      return earnWrite(deps, "range", { op: "supply", amountBase: intent.amountBase }, intent.kind, onPhase);
    case "range-withdraw":
      return earnWrite(deps, "range", { op: "withdraw", shares: intent.shares }, intent.kind, onPhase);
  }
}

/** The lanes' entry points, kept for the reference's export names; the session's submitter is the usual caller. */
export function submitRangeOpenWrite(deps: SeatLaneDeps, intent: Extract<RangeIntent, { kind: "range-open" }>, onPhase?: PhaseListener): Promise<RangeOpenOutcome> {
  return rangeOpenLane(deps, intent, onPhase);
}

export function submitRangeTx(deps: SeatLaneDeps, intent: RangeIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return rangeTxLane(deps, intent, onPhase);
}
