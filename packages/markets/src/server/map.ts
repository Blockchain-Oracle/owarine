/**
 * Seat contracts onto the core types every surface already renders (research 05 §C). Integers throughout: a lot pays
 * `1000 × cashUnit` base units if it wins, so a leg's `contractsRaw = lots × 1000 × cashUnit` at the cash's decimals,
 * and what the seat paid is `backingShare + feePaid`, exact by construction (plan §7).
 */
import {
  SIDE_TO_OUTCOME,
  type Address,
  type BalanceSheet,
  type ClaimLeg,
  type ClaimableRow,
  type MarketId,
  type OpenPosition,
} from "@owarine/core/types";
import type { LegView, QuoteView, ResolutionView, TermsView } from "./contracts";
import type { SeatSnapshot } from "./reads";

/** Venue cash is 6-decimal demo credits (plan §7, research 05 §D). */
export const CASH_DECIMALS = 6;
const PAIR_TICKS = 1000n;

export const contractsOf = (lots: bigint, cashUnit: bigint): bigint => lots * PAIR_TICKS * cashUnit;
const sum = (xs: readonly bigint[]): bigint => xs.reduce((a, b) => a + b, 0n);

export function balanceSheet(snap: SeatSnapshot, decimals = CASH_DECIMALS): BalanceSheet {
  return {
    decimals,
    spendableBase: sum(snap.cash.map((c) => c.amount)),
    // Kept for the shape: a seat has no fee token and nothing escrowed in a quote (the venue locks its own stake).
    nativeLamports: 0n,
    orderEscrowBase: 0n,
    venueCreditBase: 0n,
    venueCreditByMarket: [],
    vaultBase: null,
  };
}

/**
 * One row per Window the seat holds legs in. The mark is the venue ladder's mid while the Window is quoting (`marks`,
 * keyed by terms id, as `2 × midYesTicks` so a half tick stays exact): Up lots are worth `contracts × mid2 / 2000`,
 * Down lots `contracts × (2000 − mid2) / 2000`, floored. With no ladder (not yet open, locked, settling) the mark is the
 * entry (the legs' backing), so unrealized P&L reads as the fee paid, never an invented price. Legs whose terms the
 * venue read cannot find are skipped rather than shown without times.
 */
export function openPositions(legs: readonly LegView[], termsById: ReadonlyMap<string, TermsView>, decimals = CASH_DECIMALS, marks: ReadonlyMap<string, number> = new Map()): OpenPosition[] {
  const one = 10n ** BigInt(decimals);
  const byMarket = new Map<MarketId, LegView[]>();
  for (const leg of legs) byMarket.set(leg.marketId, [...(byMarket.get(leg.marketId) ?? []), leg]);
  const rows: OpenPosition[] = [];
  for (const [marketId, group] of byMarket) {
    const terms = termsById.get(group[0]!.termsCid);
    if (!terms) continue;
    const up = sum(group.filter((l) => l.side === "up").map((l) => contractsOf(l.lots, l.cashUnit)));
    const down = sum(group.filter((l) => l.side === "down").map((l) => contractsOf(l.lots, l.cashUnit)));
    const costBasisBase = sum(group.map((l) => l.backingShare + l.feePaid));
    const mid2 = marks.get(group[0]!.termsCid);
    const markValueBase = mid2 === undefined ? sum(group.map((l) => l.backingShare)) : (up * BigInt(mid2) + down * BigInt(2000 - mid2)) / 2000n;
    const held = up + down;
    rows.push({
      marketId,
      asset: terms.symbol,
      intervalSec: Math.round((terms.expiryMs - terms.tradingStartMs) / 1000),
      expirySec: Math.floor(terms.expiryMs / 1000),
      decimals,
      balanceUpRaw: up,
      balanceDownRaw: down,
      costBasisBase,
      avgCostRaw: held > 0n ? (costBasisBase * one) / held : 0n,
      markValueBase,
      unrealizedPnlBase: markValueBase - costBasisBase,
      realizedPnlBase: 0n,
    });
  }
  return rows.sort((a, b) => a.expirySec - b.expirySec);
}

/**
 * The ladder's mid in YES ticks, doubled (`bestAskUp + bestBidUp`, where Up's best bid is `1000 − bestAskDown`); with
 * one side only, the pricer's fair value doubled; null when the Window is not quoting.
 */
export function ladderMid2(l: { up: readonly (readonly [number, unknown])[]; down: readonly (readonly [number, unknown])[]; fairTicks?: number | null | undefined; state: string }): number | null {
  if (l.state !== "quoting") return null;
  const ask = l.up[0]?.[0];
  const downAsk = l.down[0]?.[0];
  if (ask !== undefined && downAsk !== undefined) return ask + (1000 - downAsk);
  return typeof l.fairTicks === "number" ? 2 * l.fairTicks : null;
}

/** What a leg pays its owner under a resolution (`PM.Leg.legPayout`); null resolution = void. */
export function legPayout(leg: LegView, resolution: Pick<ResolutionView, "outcome">): bigint {
  if (resolution.outcome === null) return leg.backingShare + leg.feePaid;
  return resolution.outcome === leg.side ? contractsOf(leg.lots, leg.cashUnit) : 0n;
}

export type ClaimPlan =
  | { kind: "claim"; leg: LegView; resolution: ResolutionView; payoutBase: bigint }
  | { kind: "stale-refund"; leg: LegView; payoutBase: bigint };

/**
 * Each leg's exit, if it has one now: `Leg_Claim` once its Window has a resolution, `Leg_RefundStale` once
 * `refundAfter` has passed with none (`assertDeadlineExceeded` passes AT the deadline). A losing leg has an exit that
 * pays nothing; it is listed here so the claim route can clear it, but never shown as claimable.
 */
export function claimPlans(legs: readonly LegView[], resolutions: ReadonlyMap<string, ResolutionView>, nowMs: number): ClaimPlan[] {
  const plans: ClaimPlan[] = [];
  for (const leg of legs) {
    const resolution = resolutions.get(leg.termsCid);
    if (resolution) plans.push({ kind: "claim", leg, resolution, payoutBase: legPayout(leg, resolution) });
    else if (nowMs >= leg.refundAfterMs) plans.push({ kind: "stale-refund", leg, payoutBase: leg.backingShare + leg.feePaid });
  }
  return plans;
}

export function claimables(plans: readonly ClaimPlan[], termsById: ReadonlyMap<string, TermsView>, decimals = CASH_DECIMALS): ClaimableRow[] {
  const byMarket = new Map<MarketId, ClaimPlan[]>();
  for (const plan of plans) if (plan.payoutBase > 0n) byMarket.set(plan.leg.marketId, [...(byMarket.get(plan.leg.marketId) ?? []), plan]);
  const rows: ClaimableRow[] = [];
  for (const [marketId, group] of byMarket) {
    const first = group[0]!;
    const terms = termsById.get(first.leg.termsCid);
    const resolution = first.kind === "claim" ? first.resolution : null;
    const legs: ClaimLeg[] = group.map((p) => ({ outcomeIdx: SIDE_TO_OUTCOME[p.leg.side], amountRaw: contractsOf(p.leg.lots, p.leg.cashUnit), payoutBase: p.payoutBase }));
    rows.push({
      kind: first.kind === "stale-refund" ? "stale-refund" : resolution?.outcome === null ? "void" : "win",
      marketId,
      marketAddress: marketId as Address,
      asset: terms?.symbol ?? "",
      intervalSec: terms ? Math.round((terms.expiryMs - terms.tradingStartMs) / 1000) : 0,
      expirySec: terms ? Math.floor(terms.expiryMs / 1000) : 0,
      legs,
      netPayoutBase: sum(group.map((p) => p.payoutBase)),
      feeBps: 0,
      decimals,
      settledAtMs: resolution?.createdAtMs ?? null,
    });
  }
  return rows;
}

/** An open quote as the seat sees it: what it would cost to accept, and until when. */
export interface OpenQuoteRow {
  quoteCid: string;
  marketId: MarketId;
  side: QuoteView["side"];
  priceTicks: bigint;
  lots: bigint;
  contractsRaw: bigint;
  costBase: bigint;
  feeBase: bigint;
  validUntilMs: number;
}

export function openQuotes(quotes: readonly QuoteView[]): OpenQuoteRow[] {
  return quotes.map((q) => ({
    quoteCid: q.cid,
    marketId: q.marketId,
    side: q.side,
    priceTicks: q.priceTicks,
    lots: q.lots,
    contractsRaw: contractsOf(q.lots, q.cashUnit),
    costBase: q.lots * q.priceTicks * q.cashUnit + q.fee,
    feeBase: q.fee,
    validUntilMs: q.validUntilMs,
  }));
}

/**
 * When the seat is next idle: its last open leg's refund deadline or live quote's expiry (the lease's busy clock). A
 * resting call holds the seat's cash until it ends (C7c), so its expiry counts too: a seat is never drained under one.
 */
export function busyUntilMs(snap: Pick<SeatSnapshot, "legs" | "quotes" | "buyQuotes" | "restingCalls">): number {
  return Math.max(
    0,
    ...snap.legs.map((l) => l.refundAfterMs),
    ...snap.quotes.map((q) => q.validUntilMs),
    ...(snap.buyQuotes ?? []).map((q) => q.validUntilMs),
    ...(snap.restingCalls ?? []).map((c) => c.expiresAtMs),
  );
}
