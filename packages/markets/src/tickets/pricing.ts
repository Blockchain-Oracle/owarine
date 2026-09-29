/**
 * Ticket pricing off one venue ladder (C8c), with core's kernels and nothing else: `quoteRange` for a band,
 * `quoteParlay` for legs, the leverage sizing (`budgetFor`, `terms`, `knockoutLine`) for a boost. Pure: ops calls it
 * to issue and to preview, and the tests pin it. What comes out is exactly what the `RiskBook` choices take.
 *
 * The range basis is the Window's own: its opening print, the venue ladder's fair price read as P(close ≥ open)
 * (`centerQE6 = fairTicks × 1000`), and the house σ for the symbol.
 */
import type { BookLevel } from "@agari/core/market";
import { budgetFor, knockoutLine, terms as boostTermsOf, type LeverageParams, type LeverageQuote, type LeverageRefusal } from "@agari/core/leverage";
import { quoteParlay, type ParlayMode, type ParlayParams, type ParlayQuote, type ParlayRefusal } from "@agari/core/parlay";
import { probitE4, quoteRange, stdE8, type RangeBasis, type RangeMode, type RangeParams, type RangeQuote, type RangeRefusal, type RangeSide } from "@agari/core/range";
import type { BookLevelView } from "@agari/core/types";
import { bidLevels, walkExit, walkStake } from "../ops/canton/quote-walk";
import { sigmaFor, TICKET_DECIMALS, TICKET_ONE, TICKET_QUOTE_LIFE_SEC } from "./params";

/** What a ticket needs from one Window's ladder: structurally a subset of ops' `LadderEntry`. */
export interface TicketWindow {
  termsCid: string;
  marketId: string;
  damlMarketId: string;
  symbol: string;
  openPriceE8: bigint;
  /** The venue's fair YES price in ticks (P(close ≥ open) × 1000). */
  fairTicks: number;
  lockAtSec: number;
  expirySec: number;
  cashUnit: bigint;
  up: readonly BookLevel[];
  down: readonly BookLevel[];
}

const E8 = 100_000_000n;
const BPS = 10_000n;

/** A firm quote's life: the quote life, never past the Window's lock (the ledger's `validUntil <= lockAt`). */
export function validUntilFor(w: Pick<TicketWindow, "lockAtSec">, nowSec: number, lifeSec = TICKET_QUOTE_LIFE_SEC): number {
  return Math.min(nowSec + lifeSec, w.lockAtSec);
}

export function rangeBasisOf(w: TicketWindow, nowSec: number): { openingPrint: bigint; centerQE6: bigint; sigmaE8: bigint; basis: RangeBasis } {
  const tauSec = Math.max(1, w.expirySec - nowSec);
  const centerQE6 = BigInt(Math.min(999, Math.max(1, w.fairTicks))) * 1_000n;
  const sigmaE8 = sigmaFor(w.symbol);
  return { openingPrint: w.openPriceE8, centerQE6, sigmaE8, basis: { centerQE6: Number(centerQE6), sigmaE8: Number(sigmaE8), tauSec } };
}

export type RangePriced =
  | { ok: true; quote: RangeQuote; basis: RangeBasis; openingPrint: bigint }
  | { ok: false; refusal: RangeRefusal | { kind: "too-late"; leftSec: number; minSec: number } | { kind: "centre"; centerQE6: number } };

export function priceRange(w: TicketWindow, band: { side: RangeSide; lowPrint: bigint; highPrint: bigint }, mode: RangeMode, params: RangeParams, nowSec: number, nowMs = nowSec * 1000): RangePriced {
  const leftSec = w.expirySec - nowSec;
  if (leftSec < params.minTimeLeftSec) return { ok: false, refusal: { kind: "too-late", leftSec, minSec: params.minTimeLeftSec } };
  const b = rangeBasisOf(w, nowSec);
  if (b.basis.centerQE6 < params.minCenterQE6 || b.basis.centerQE6 > params.maxCenterQE6) return { ok: false, refusal: { kind: "centre", centerQE6: b.basis.centerQE6 } };
  const r = quoteRange({
    openingPrint: b.openingPrint, lowPrint: band.lowPrint, highPrint: band.highPrint, side: band.side, centerQE6: b.centerQE6, sigmaE8: b.sigmaE8,
    tauSec: b.basis.tauSec, mode, params, one: TICKET_ONE, decimals: TICKET_DECIMALS, nowMs,
  });
  return r.ok ? { ok: true, quote: r.quote, basis: b.basis, openingPrint: b.openingPrint } : { ok: false, refusal: r.refusal };
}

/** A side's ladder as core's `BookLevelView[]` in that side's own terms: price per whole contract, depth in contracts. */
export function asksOf(w: Pick<TicketWindow, "up" | "down" | "cashUnit">, side: "up" | "down"): BookLevelView[] {
  const levels = side === "up" ? w.up : w.down;
  return levels.map(([ticks, lots]) => ({ priceRaw: (BigInt(ticks) * TICKET_ONE) / 1000n, priceBps: ticks * 10, quantityRaw: lots * 1000n * w.cashUnit }));
}

export type ParlayPriced =
  | { ok: true; quote: ParlayQuote }
  | { ok: false; refusal: ParlayRefusal | { kind: "too-late"; legIdx: number; leftSec: number; minSec: number } | { kind: "duplicate-leg" } };

export function priceParlay(legs: ReadonlyArray<{ window: TicketWindow; side: "up" | "down" }>, mode: ParlayMode, params: ParlayParams, nowSec: number, nowMs = nowSec * 1000): ParlayPriced {
  if (new Set(legs.map((l) => l.window.termsCid)).size !== legs.length) return { ok: false, refusal: { kind: "duplicate-leg" } };
  for (const [i, l] of legs.entries()) {
    const leftSec = l.window.expirySec - nowSec;
    if (leftSec < params.minTimeLeftSec) return { ok: false, refusal: { kind: "too-late", legIdx: i, leftSec, minSec: params.minTimeLeftSec } };
  }
  const r = quoteParlay({
    legs: legs.map((l) => ({ expirySec: l.window.expirySec, asks: asksOf(l.window, l.side) })),
    mode, params, one: TICKET_ONE, decimals: TICKET_DECIMALS, nowMs,
  });
  return r.ok ? { ok: true, quote: r.quote } : { ok: false, refusal: r.refusal };
}

/** Everything `Book_IssueBoost` takes, priced. */
export interface BoostTerms {
  priceTicks: number;
  lots: bigint;
  cashUnit: bigint;
  leverageBps: number;
  stake: bigint;
  fronted: bigint;
  premium: bigint;
  barrierE8: bigint;
  knockOutProceeds: bigint;
}

export type BoostPriced = { ok: true; terms: BoostTerms; quote: LeverageQuote } | { ok: false; refusal: LeverageRefusal };

const mulDivFloor = (a: bigint, b: bigint, c: bigint) => (a * b) / c;

/** The ledger's `boostTermsOk`, mirrored so a quote the book would refuse is never sent. */
export function boostTermsOk(t: BoostTerms): boolean {
  const cost = t.lots * BigInt(t.priceTicks) * t.cashUnit;
  const quantity = t.lots * 1000n * t.cashUnit;
  return (
    t.priceTicks >= 1 && t.priceTicks <= 999 && t.lots > 0n && t.leverageBps >= 10_000 && t.leverageBps <= 100_000 &&
    t.premium >= 0n && t.premium <= t.fronted && t.stake > t.premium && t.stake + t.fronted - t.premium === cost &&
    t.fronted <= mulDivFloor(t.stake, BigInt(t.leverageBps) - BPS, BPS) && quantity - t.fronted > t.stake &&
    (t.fronted === 0n || (t.barrierE8 > 0n && t.knockOutProceeds >= t.fronted)) && t.knockOutProceeds >= 0n && t.knockOutProceeds <= quantity
  );
}

/**
 * The underlying level at which a boost's side is worth its knock-out line: P(side) = line / quantity, turned into a
 * price with the same Normal the range reserve prices on (σ√τ over the position's remaining life). Up knocks out at or
 * below it, Down at or above it.
 */
export function barrierFor(w: TicketWindow, side: "up" | "down", lineBase: bigint, quantityRaw: bigint, fromSec: number): bigint {
  if (lineBase <= 0n || quantityRaw <= 0n) return 0n;
  const pE6 = (lineBase * 1_000_000n) / quantityRaw;
  const z = probitE4(pE6 < 1n ? 1n : pE6 > 999_999n ? 999_999n : pE6);
  const std = stdE8(sigmaFor(w.symbol), Math.max(1, w.expirySec - fromSec));
  // Up is worth p when the price sits z deviations from the open; Down mirrors it.
  const zSide = side === "up" ? z : -z;
  const move = (w.openPriceE8 * ((zSide * std) / 10_000n)) / E8;
  const barrier = w.openPriceE8 + move;
  return barrier > 0n ? barrier : 1n;
}

/**
 * Stake-first, as the reference opens: the stake and multiple set a budget (`budgetFor`), the budget buys as many lots
 * as the side's ladder sells at one price (the issuer's own `walkStake`), and the cost sets the front and premium
 * (`terms`). Integer adjustments keep the ledger's `fronted ≤ stake × (L − 1)`; the knock-out proceeds are pinned at
 * the line (`fronted × maintenance`, K-029), never above the contracts' face.
 */
export function priceBoost(w: TicketWindow, side: "up" | "down", stakeBase: bigint, leverageBps: number, params: LeverageParams, nowSec: number, o: { maxLots?: bigint; nowMs?: number } = {}): BoostPriced {
  const refuse = (refusal: LeverageRefusal): BoostPriced => ({ ok: false, refusal });
  if (stakeBase <= 0n) return refuse({ kind: "zero" });
  if (leverageBps < 10_000 || leverageBps > params.maxLeverageBps) return refuse({ kind: "bad-leverage", maxLeverageBps: params.maxLeverageBps });
  const leftSec = w.expirySec - nowSec;
  if (leftSec < params.minTimeLeftSec) return refuse({ kind: "too-late", leftSec, minSec: params.minTimeLeftSec });
  const levels = side === "up" ? w.up : w.down;
  const premiumBps = leverageBps === 10_000 ? 0 : params.premiumBps;
  let budget = leverageBps === 10_000 ? stakeBase : budgetFor(stakeBase, leverageBps, premiumBps);
  for (let attempt = 0; attempt < 6; attempt++) {
    const walked = walkStake(levels, budget, w.cashUnit, 0, o.maxLots !== undefined ? { maxLots: o.maxLots } : {});
    if (!walked) return levels.length === 0 ? refuse({ kind: "thin-book", filledRaw: 0n, quantityRaw: 0n }) : refuse({ kind: "below-min", quantityRaw: 0n, minQuantityRaw: 1000n * w.cashUnit });
    const quantity = walked.lots * 1000n * w.cashUnit;
    const priceRaw = (BigInt(walked.priceTicks) * TICKET_ONE) / 1000n;
    if (priceRaw < params.minEntryPriceRaw || priceRaw > params.maxEntryPriceRaw) return refuse({ kind: "outside-band", priceRaw, minRaw: params.minEntryPriceRaw, maxRaw: params.maxEntryPriceRaw });
    const cost = walked.costBase;
    let t = leverageBps === 10_000 ? { stakeBase: cost, frontedBase: 0n, premiumBase: 0n } : boostTermsOf(cost, leverageBps, premiumBps);
    // `terms` rounds the front down from a ceiling nominal; the ledger bounds it by the stake it ends up with.
    while (t.frontedBase > 0n && t.frontedBase > mulDivFloor(t.stakeBase, BigInt(leverageBps) - BPS, BPS)) {
      const fronted = t.frontedBase - 1n;
      const premium = (fronted * BigInt(premiumBps)) / BPS;
      t = { stakeBase: cost + premium - fronted, frontedBase: fronted, premiumBase: premium };
    }
    if (t.stakeBase > stakeBase) {
      // Rounding put the charge a unit over the stake: spend a little less and walk again.
      budget -= (t.stakeBase - stakeBase) * 2n + 1n;
      continue;
    }
    if (quantity - t.frontedBase <= t.stakeBase) return refuse({ kind: "underpriced" });
    if (t.frontedBase > params.maxFrontedPerPositionBase) return refuse({ kind: "position-cap", frontedBase: t.frontedBase, capBase: params.maxFrontedPerPositionBase });
    const line = t.frontedBase === 0n ? 0n : knockoutLine(t.frontedBase, params.maintenanceBps);
    const knockOutProceeds = line > quantity ? quantity : line;
    const fromSec = validUntilFor(w, nowSec);
    const barrierE8 = t.frontedBase === 0n ? 0n : barrierFor(w, side, knockOutProceeds, quantity, fromSec);
    const out: BoostTerms = {
      priceTicks: walked.priceTicks, lots: walked.lots, cashUnit: w.cashUnit, leverageBps, stake: t.stakeBase, fronted: t.frontedBase, premium: t.premiumBase,
      barrierE8, knockOutProceeds,
    };
    if (!boostTermsOk(out)) return refuse({ kind: "underpriced" });
    const yesTicks = side === "up" ? walked.priceTicks : 1000 - walked.priceTicks;
    return {
      ok: true,
      terms: out,
      quote: {
        side, leverageBps, quantityRaw: quantity, costBase: cost, limitYesRaw: (BigInt(yesTicks) * TICKET_ONE) / 1000n, priceRaw,
        stakeBase: t.stakeBase, frontedBase: t.frontedBase, premiumBase: t.premiumBase, winIfRightBase: quantity - t.frontedBase, lineBase: knockOutProceeds,
        decimals: TICKET_DECIMALS, quotedAtMs: o.nowMs ?? nowSec * 1000,
      },
    };
  }
  return refuse({ kind: "underpriced" });
}

/** A boost's mark off the ladder's fair price: what its contracts are worth at the venue's mid, and the knock-out line. */
export function boostMark(p: { side: "up" | "down"; lots: bigint; cashUnit: bigint; fronted: bigint; knockOutProceeds: bigint }, fairTicks: number | null): { markBase: bigint; lineBase: bigint; knockable: boolean } {
  const ticks = fairTicks === null ? null : p.side === "up" ? fairTicks : 1000 - fairTicks;
  const markBase = ticks === null ? 0n : p.lots * BigInt(ticks) * p.cashUnit;
  return { markBase, lineBase: p.knockOutProceeds, knockable: p.fronted > 0n && ticks !== null && markBase <= p.knockOutProceeds };
}

/**
 * What a boost is worth now for "Yours now" and the cash-out floor: what the venue's bids would pay for the whole
 * position (the reference marks over the exit side, `markOverLevels(book.exitRested…)`), else the fair mid when the
 * bids cannot take it all, else nothing. Marking at the mid put the floor (97% of the mark) above every bid once the
 * spread passed 3%, so a cash-out always came back as a requote (C8e).
 */
export function boostMarkBase(p: { side: "up" | "down"; lots: bigint; cashUnit: bigint }, ladder: { up: readonly BookLevel[]; down: readonly BookLevel[] } | undefined, fairTicks: number | undefined): bigint | null {
  const exit = ladder ? walkExit(bidLevels(ladder, p.side), p.lots, p.cashUnit) : null;
  if (exit && exit.lots >= p.lots) return exit.proceedsBase;
  if (fairTicks === undefined) return null;
  return p.lots * BigInt(p.side === "up" ? fairTicks : 1000 - fairTicks) * p.cashUnit;
}
