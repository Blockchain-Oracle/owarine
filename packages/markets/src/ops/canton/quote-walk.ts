/**
 * The issuer's walk of the venue price ladder (plan §6): the same kernel the ticket uses for its indicative price
 * (core `vwapOverDepth` over `BookLevel[]`), so the firm quote and the number the user saw come from one function.
 *
 * A firm quote has one price for all its lots: the depth-weighted average over the levels it consumes, rounded up
 * (`vwapOverDepth` rounds cost up, in the venue's favour by at most one tick). Integers only.
 */
import { vwapOverDepth, type BookLevel } from "@agari/core/market";

export const PAIR_TICKS = 1000n;
export const FEE_DENOMINATOR = 10_000_000_000n;

/** `⌈quantity × rateBps × t × (1000 − t) / 10¹⁰⌉` with `quantity = lots × 1000 × cashUnit` (plan §7), exact. */
export function feeFor(lots: bigint, ticks: number, cashUnit: bigint, rateBps: number): bigint {
  if (lots <= 0n || rateBps <= 0) return 0n;
  const t = BigInt(ticks);
  const a = lots * PAIR_TICKS * cashUnit * BigInt(rateBps) * t * (PAIR_TICKS - t);
  return (a + FEE_DENOMINATOR - 1n) / FEE_DENOMINATOR;
}

export interface WalkedQuote {
  lots: bigint;
  priceTicks: number;
  fee: bigint;
  /** What the user pays: `lots × priceTicks × cashUnit + fee`. */
  costBase: bigint;
  /** What the venue locks: `lots × (1000 − priceTicks) × cashUnit`. */
  venueStakeBase: bigint;
}

export function costOf(lots: bigint, levels: readonly BookLevel[], cashUnit: bigint, rateBps: number): WalkedQuote | null {
  const { vwapTicks, filled } = vwapOverDepth(levels, lots);
  if (filled < lots || filled === 0n) return null;
  const priceTicks = Number(vwapTicks);
  if (priceTicks < 1 || priceTicks > 999) return null;
  const fee = feeFor(lots, priceTicks, cashUnit, rateBps);
  return { lots, priceTicks, fee, costBase: lots * BigInt(priceTicks) * cashUnit + fee, venueStakeBase: lots * (PAIR_TICKS - BigInt(priceTicks)) * cashUnit };
}

/**
 * The most lots a stake buys on this side's ladder, fee included, capped at `maxLots`. Cost grows with lots (each lot
 * costs at least one tick), so a binary search over `[minLots, min(depth, maxLots)]` finds the largest that fits.
 * Null when not even `minLots` fits.
 */
export function walkStake(levels: readonly BookLevel[], stakeBase: bigint, cashUnit: bigint, rateBps: number, o: { minLots?: bigint; maxLots?: bigint } = {}): WalkedQuote | null {
  const minLots = o.minLots ?? 1n;
  if (stakeBase <= 0n || cashUnit <= 0n) return null;
  let depth = 0n;
  for (const [, lots] of levels) depth += lots;
  let hi = o.maxLots !== undefined && o.maxLots < depth ? o.maxLots : depth;
  let lo = minLots;
  const fits = (n: bigint) => {
    const q = costOf(n, levels, cashUnit, rateBps);
    return q !== null && q.costBase <= stakeBase ? q : null;
  };
  let best = lo <= hi ? fits(lo) : null;
  if (!best) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    const q = fits(mid);
    if (q) {
      best = q;
      lo = mid;
    } else hi = mid - 1n;
  }
  return best;
}
