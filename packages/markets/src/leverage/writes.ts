/**
 * Boost and Short writes on Canton (C8c), through the ticket lane: the open is a firm `BoostQuote` (stake-first; a
 * requote, nothing issued, when fewer contracts than the owner's guard), then the seat's own `BoostQuote_Accept`. A
 * cash-out is a firm whole-position buy-back (`Boost_OfferExit`) the seat accepts; settle and claim are the owner's
 * `Boost_Claim` (or the stale refund past `refundAfter`). Knock-out is the venue's alone, on the Window's oracle quorum.
 */
import type { LeverageIntent } from "@owarine/core/leverage";
import type { PhaseListener, TxOutcome } from "@owarine/core/ports";
import { diagnosis, type Diagnosis } from "@owarine/core/types";
import type { SeatLaneDeps } from "../submitter/seat-lane";
import { acceptTicketQuote, asTxOutcome, exitTicket } from "../submitter/ticket-lane";
import { boostCall, rememberTicket, ticketCidOf } from "../tickets/client";
import { earnWrite } from "../tickets/earn-lane";
import type { LeverageOpenOutcome } from "./types";

const refused = (d: Diagnosis) => ({ status: "refused" as const, diagnosis: d });

export async function leverageOpenLane(deps: SeatLaneDeps, intent: Extract<LeverageIntent, { kind: "leverage-open" }>, onPhase?: PhaseListener): Promise<LeverageOpenOutcome> {
  const issued = await boostCall({ op: "issue", marketId: intent.marketId, side: intent.side, stakeBase: intent.stakeBase, leverageBps: intent.leverageBps, minQuantityRaw: intent.minQuantityRaw });
  if (!issued.ok) return refused(issued.diagnosis);
  const q = issued.value;
  if (q.kind === "refused") return refused(q.diagnosis);
  if (q.kind === "requote") return { status: "requote", stakeBase: q.quote?.stakeBase ?? intent.stakeBase, quantityRaw: q.quote?.quantityRaw ?? 0n };
  if (q.kind !== "quote") return refused(diagnosis("unknown", `unexpected ${q.kind} reply to a boost issue`));
  const w = await acceptTicketQuote(deps, "boost", q.quoteCid, { kind: "leverage-open", summary: `${intent.side} ${intent.leverageBps / 10_000}x for ${q.quote.stakeBase}`, marketId: intent.marketId }, q.validUntilMs, onPhase);
  if (w.status !== "confirmed") return w;
  return {
    status: "confirmed", txHash: w.txHash, positionId: w.ticketCid ? rememberTicket("boost", w.ticketCid) : 0n,
    stakeBase: q.quote.stakeBase, quantityRaw: q.quote.quantityRaw, frontedBase: q.quote.frontedBase,
  };
}

export async function leverageTxLane(deps: SeatLaneDeps, intent: LeverageIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  switch (intent.kind) {
    case "leverage-open": {
      const o = await leverageOpenLane(deps, intent, onPhase);
      return o.status === "requote" ? refused(diagnosis("requote", `this stake now buys ${o.quantityRaw}`)) : o.status === "confirmed" ? { status: "confirmed", txHash: o.txHash } : o;
    }
    case "leverage-close": {
      const cid = await ticketCidOf("boost", intent.positionId);
      if (!cid) return refused(diagnosis("already-claimed", "this seat holds no such boost (settled, knocked out or sold)"));
      const offer = await boostCall({ op: "exit", positionCid: cid, minProceedsBase: intent.minProceedsBase });
      if (!offer.ok) return refused(offer.diagnosis);
      const q = offer.value;
      if (q.kind === "refused") return refused(q.diagnosis);
      if (q.kind === "requote") return refused(diagnosis("requote", `the venue now pays ${q.proceedsBase ?? 0n} for the position`));
      if (q.kind !== "exit-quote") return refused(diagnosis("unknown", `unexpected ${q.kind} reply to a boost exit`));
          return asTxOutcome(await acceptTicketQuote(deps, "boost", q.quoteCid, { kind: intent.kind, summary: `cash out boost ${intent.positionId} for ${q.proceedsBase}`, marketId: intent.marketId }, q.validUntilMs, onPhase));
    }
    case "leverage-settle":
    case "leverage-claim": {
      const cid = await ticketCidOf("boost", intent.positionId);
      if (!cid) return refused(diagnosis("already-claimed", "this seat holds no such boost (settled, knocked out or sold)"));
      return asTxOutcome(await exitTicket(deps, "boost", "claim", cid, { kind: intent.kind, summary: `settle boost ${intent.positionId}` }, onPhase));
    }
    case "leverage-knock-out":
      return refused(diagnosis("contract-revert", "a boost is knocked out by the venue alone, on the Window's own oracle quorum beyond its barrier (K-029)"));
    case "leverage-supply":
      return earnWrite(deps, "boost", { op: "supply", amountBase: intent.amountBase }, intent.kind, onPhase);
    case "leverage-withdraw":
      return earnWrite(deps, "boost", { op: "withdraw", shares: intent.shares }, intent.kind, onPhase);
  }
}

export function submitLeverageOpenWrite(deps: SeatLaneDeps, intent: Extract<LeverageIntent, { kind: "leverage-open" }>, onPhase?: PhaseListener): Promise<LeverageOpenOutcome> {
  return leverageOpenLane(deps, intent, onPhase);
}

export function submitLeverageTx(deps: SeatLaneDeps, intent: LeverageIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return leverageTxLane(deps, intent, onPhase);
}
