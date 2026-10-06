import type { EventMarket } from "../types/market";
import type { ClaimableRow, ClaimLeg, Holdings } from "../types/trading";
import { winPayoutBase } from "./payout";
import type { PaidBySide } from "./verdict";

/** What a claim needs to know about a settled market — a wallet's portfolio row carries all of it. */
export type SettledMarket = Pick<
  EventMarket,
  "marketId" | "marketAddress" | "asset" | "intervalSec" | "expirySec" | "decimals" | "voided" | "winningOutcome" | "resolvedAtMs"
>;

export interface SettledHolding {
  market: SettledMarket;
  holdings: Holdings;
  feeBps: number;
  /** What each side's legs cost (backing plus fee): a void returns exactly this (`PM.Leg.legPayout`). */
  paid?: PaidBySide;
}

/** A void refunds each side's cost; with that cost unread there is no row, never a guessed refund. */
function voidLegs(holdings: Holdings, paid: PaidBySide | undefined): ClaimLeg[] {
  if (!paid) return [];
  const legs: ClaimLeg[] = [];
  if (holdings.upRaw > 0n) legs.push({ outcomeIdx: 0, amountRaw: holdings.upRaw, payoutBase: paid.up });
  if (holdings.downRaw > 0n) legs.push({ outcomeIdx: 1, amountRaw: holdings.downRaw, payoutBase: paid.down });
  return legs;
}

function winLegs(market: SettledMarket, holdings: Holdings): ClaimLeg[] {
  if (market.winningOutcome === null) return [];
  const amountRaw = market.winningOutcome === 0 ? holdings.upRaw : holdings.downRaw;
  if (amountRaw === 0n) return [];
  return [{ outcomeIdx: market.winningOutcome, amountRaw, payoutBase: winPayoutBase(amountRaw) }];
}

/** Every claimable row for a wallet: voids redeem BOTH sides as one row with two legs; a losing side is never a row (canon #11). */
export function enumerateClaimables(settled: readonly SettledHolding[]): ClaimableRow[] {
  const rows: ClaimableRow[] = [];
  for (const { market, holdings, feeBps, paid } of settled) {
    const kind = market.voided ? "void" : "win";
    const legs = kind === "void" ? voidLegs(holdings, paid) : winLegs(market, holdings);
    const netPayoutBase = legs.reduce((sum, leg) => sum + leg.payoutBase, 0n);
    if (netPayoutBase === 0n) continue;
    rows.push({
      kind,
      marketId: market.marketId,
      marketAddress: market.marketAddress,
      asset: market.asset,
      intervalSec: market.intervalSec,
      expirySec: market.expirySec,
      legs,
      netPayoutBase,
      feeBps,
      decimals: market.decimals,
      settledAtMs: market.resolvedAtMs,
    });
  }
  return rows.sort((a, b) => b.expirySec - a.expirySec);
}

export function netClaimableSum(rows: readonly ClaimableRow[]): bigint {
  return rows.reduce((sum, row) => sum + row.netPayoutBase, 0n);
}
