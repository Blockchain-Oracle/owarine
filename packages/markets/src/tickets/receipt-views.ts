/**
 * Ended tickets in the reference's shapes, from the seat's `SettlementReceipt`s (K-088). A ticket's contract is
 * archived when it ends; its receipt stays with the owner, so history reads the receipt:
 *
 *   range, moonshot, parlay   won → "claimed" (the ledger pays out on settle; there is nothing left to claim),
 *                             lost → "lost", void (a voided Window, a stale refund or void) → "void"
 *   boost, short              won / lost / void → "settled", "sold" → "closed" (cashed out), "knocked-out"
 *
 * Every figure is the receipt's own: the escrow is what it paid the owner plus what it paid the reserve
 * (`payout + toReserve`), the receipt's creation time is the settled time, and what it cannot say (the open time)
 * stays 0 as for live tickets. A receipt's id is its contract's, and is never registered as a claimable ticket.
 */
import type { LeveragePosition } from "@agari/core/leverage";
import type { ParlayLeg, ParlayTicket } from "@agari/core/parlay";
import type { RangeRound } from "@agari/core/range";
import type { Address } from "@agari/core/types";
import { parseBoostPick, parseRangePick } from "./receipt-pick";
import type { TicketReceiptView } from "../provider/ticket-wire";
import { ticketIdOf } from "./client";
import { TICKET_ONE } from "./params";

type Ended = "claimed" | "lost" | "void";
const endedOf = (result: TicketReceiptView["result"]): Ended => (result === "won" ? "claimed" : result === "lost" ? "lost" : "void");

export function rangeRoundOfReceipt(v: TicketReceiptView, owner: Address): RangeRound | null {
  if (v.product !== "range" && v.product !== "moonshot") return null;
  const band = parseRangePick(v.pick);
  if (!band) return null;
  const maxPayoutBase = v.payout + v.toReserveBase;
  return {
    roundId: ticketIdOf(v.cid), owner, status: endedOf(v.result), side: band.side, marketId: v.marketId, oracleQuestionId: 0n, expirySec: v.expirySec,
    openedAtSec: 0, settledAtSec: v.settledAtSec, openingPrint: v.openingPrint ?? 0n, lowPrint: band.lowE8, highPrint: band.highE8, closingPrint: v.closingPrint,
    stakeBase: v.stakeBase, maxPayoutBase, houseLockedBase: maxPayoutBase - v.stakeBase, probRaw: maxPayoutBase > 0n ? (v.stakeBase * TICKET_ONE) / maxPayoutBase : 0n,
  };
}

export function parlayTicketOfReceipt(v: TicketReceiptView, owner: Address): ParlayTicket | null {
  if (v.product !== "parlay" || v.legs.length === 0) return null;
  const maxPayoutBase = v.payout + v.toReserveBase;
  const legs: ParlayLeg[] = v.legs.map((l) => ({
    marketId: l.marketId, side: l.side, status: l.resolved, expirySec: l.expirySec, resolvedAtSec: l.resolved === "pending" ? null : v.settledAtSec, priceRaw: 0n,
  }));
  return {
    parlayId: ticketIdOf(v.cid), owner, status: endedOf(v.result), legCount: legs.length, wonCount: legs.filter((l) => l.status === "won").length, openedAtSec: 0,
    lastExpirySec: Math.max(...legs.map((l) => l.expirySec)), stakeBase: v.stakeBase, maxPayoutBase, houseLockedBase: maxPayoutBase - v.stakeBase,
    combinedProbRaw: maxPayoutBase > 0n ? (v.stakeBase * TICKET_ONE) / maxPayoutBase : 0n, legs,
  };
}

export function leveragePositionOfReceipt(v: TicketReceiptView, owner: Address): LeveragePosition | null {
  if (v.product !== "boost" && v.product !== "short") return null;
  const pick = parseBoostPick(v.pick);
  if (!pick || v.lots <= 0n || v.cashUnit <= 0n) return null;
  // The reserve is repaid its front first, so the owner is paid only once the front is back in full: then the front is
  // exactly what the reserve reclaimed. With nothing paid to the owner, the position's own terms give it
  // (stake + front = cost + premium, `boostTermsOk`), and every exit that pays nothing recognises the premium as the fee.
  const reclaimedBase = v.toReserveBase - v.fee;
  const frontedBase = v.payout > 0n ? reclaimedBase : v.backingShare + v.fee - v.stakeBase;
  const premiumBase = v.result === "void" ? v.stakeBase + frontedBase - v.backingShare : v.fee;
  const priceTicks = v.backingShare / (v.lots * v.cashUnit);
  return {
    positionId: ticketIdOf(v.cid), owner, status: v.result === "sold" ? "closed" : v.result === "knocked-out" ? "knocked-out" : "settled", side: pick.side,
    leverageBps: pick.leverageBps, marketId: v.marketId, openedAtSec: 0, expirySec: v.expirySec, exitedAtSec: v.settledAtSec, quantityRaw: v.lots * 1000n * v.cashUnit,
    stakeBase: v.stakeBase, frontedBase, premiumBase, entryPriceRaw: (priceTicks * TICKET_ONE) / 1000n, proceedsBase: v.payout + reclaimedBase, reclaimedBase,
    returnedBase: v.payout, owedBase: 0n,
  };
}

const present = <T>(x: T | null): x is T => x !== null;

/** The seat's ended tickets of one kind, newest first (the server sends receipts in that order). */
export const endedRounds = (receipts: readonly TicketReceiptView[], owner: Address) => receipts.map((v) => rangeRoundOfReceipt(v, owner)).filter(present);
export const endedParlays = (receipts: readonly TicketReceiptView[], owner: Address) => receipts.map((v) => parlayTicketOfReceipt(v, owner)).filter(present);
export const endedBoosts = (receipts: readonly TicketReceiptView[], owner: Address) => receipts.map((v) => leveragePositionOfReceipt(v, owner)).filter(present);
