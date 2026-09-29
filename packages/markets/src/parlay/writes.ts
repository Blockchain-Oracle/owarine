/**
 * Parlay writes on Canton (C8c), through the ticket lane: the open is a firm `ParlayQuote` at the payout the seat
 * confirmed (a requote, nothing issued, when the fresh stake is above its cap), then the seat's own
 * `ParlayQuote_Accept`. Resolving a leg and claiming are the owner's `Ticket_ClaimLeg` (the next leg in expiry order,
 * against its Window's resolution), or the stale void past `voidAfter`.
 */
import type { ParlayIntent } from "@agari/core/parlay";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import type { SeatLaneDeps } from "../submitter/seat-lane";
import { acceptTicketQuote, asTxOutcome, exitTicket } from "../submitter/ticket-lane";
import { parlayCall, rememberTicket, ticketCidOf } from "../tickets/client";
import { earnWrite } from "../tickets/earn-lane";
import type { ParlayOpenOutcome } from "./types";

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });

export async function parlayOpenLane(deps: SeatLaneDeps, intent: Extract<ParlayIntent, { kind: "parlay-open" }>, onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  const issued = await parlayCall({ op: "issue", legs: intent.legs.map((l) => ({ marketId: l.marketId, side: l.side })), maxPayoutBase: intent.maxPayoutBase, maxStakeBase: intent.maxStakeBase });
  if (!issued.ok) return refused(issued.diagnosis);
  const q = issued.value;
  if (q.kind === "refused") return refused(q.diagnosis);
  if (q.kind === "requote") return { status: "requote", stakeBase: q.stakeBase, maxPayoutBase: q.maxPayoutBase };
  if (q.kind !== "quote") return refused(diagnosis("unknown", `unexpected ${q.kind} reply to a parlay issue`));
  const w = await acceptTicketQuote(deps, "parlay", q.quoteCid, { kind: "parlay-open", summary: `${intent.legs.length}-leg parlay for ${q.maxPayoutBase}` }, q.validUntilMs, onPhase);
  if (w.status !== "confirmed") return w;
  return { status: "confirmed", txHash: w.txHash, parlayId: w.ticketCid ? rememberTicket("parlay", w.ticketCid) : 0n, stakeBase: q.stakeBase };
}

export async function parlayTxLane(deps: SeatLaneDeps, intent: ParlayIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  switch (intent.kind) {
    case "parlay-open": {
      const o = await parlayOpenLane(deps, intent, onPhase);
      return o.status === "requote" ? refused(diagnosis("requote", `the stake for this payout is now ${o.stakeBase}`)) : o.status === "confirmed" ? { status: "confirmed", txHash: o.txHash } : o;
    }
    case "parlay-resolve-leg":
    case "parlay-claim": {
      const cid = await ticketCidOf("parlay", intent.parlayId);
      if (!cid) return refused(diagnosis("already-claimed", "this seat holds no such ticket (settled, claimed or voided)"));
      return asTxOutcome(await exitTicket(deps, "parlay", "claim", cid, { kind: intent.kind, summary: `settle parlay ${intent.parlayId}` }, onPhase));
    }
    case "parlay-supply":
      return earnWrite(deps, "parlay", { op: "supply", amountBase: intent.amountBase }, intent.kind, onPhase);
    case "parlay-withdraw":
      return earnWrite(deps, "parlay", { op: "withdraw", shares: intent.shares }, intent.kind, onPhase);
  }
}

export function submitParlayOpenWrite(deps: SeatLaneDeps, intent: Extract<ParlayIntent, { kind: "parlay-open" }>, onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  return parlayOpenLane(deps, intent, onPhase);
}

export function submitParlayTx(deps: SeatLaneDeps, intent: ParlayIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return parlayTxLane(deps, intent, onPhase);
}
