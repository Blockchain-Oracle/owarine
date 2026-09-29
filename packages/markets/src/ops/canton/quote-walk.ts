/**
 * The issuer's walk of the venue price ladder (plan §6): the same kernel the ticket uses for its indicative price
 * (core `vwapOverDepth` over `BookLevel[]`), so the firm quote and the number the user saw come from one function.
 *
 * A firm quote has one price for all its lots: the depth-weighted average over the levels it consumes, rounded up
 * (`vwapOverDepth` rounds cost up, in the venue's favour by at most one tick). Integers only.
 */
import { exitWalk, vwapOverDepth, type BookLevel } from "@agari/core/market";

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

/**
 * The bid side of a venue ladder for selling `side` back (C7a exit): the venue buys Up at `1000 − t` where it sells Down at
 * `t`, so Up's bids are the Down ladder mirrored (best first stays best first), and Down's bids are the Up ladder mirrored.
 */
export function bidLevels(ladder: { up: readonly BookLevel[]; down: readonly BookLevel[] }, side: "up" | "down"): BookLevel[] {
  const opposite = side === "up" ? ladder.down : ladder.up;
  return opposite.map(([ticks, lots]) => [Number(PAIR_TICKS) - ticks, lots] as BookLevel);
}

export interface WalkedExit {
  lots: bigint;
  /** One price for every lot of the buy-back, in the sold side's own terms: the walk's average, rounded down. */
  priceTicks: number;
  /** What the user receives: `lots × priceTicks × cashUnit` (what the `BuyQuote` locks). */
  proceedsBase: bigint;
}

/**
 * Walks the bid side with core's `exitWalk` for up to `wantLots`: `lots = min(want, fillable)`, one price (the average,
 * floored, in the venue's favour by under a tick, the mirror of the buy walk's ceiling). Null when nothing fills.
 */
export function walkExit(bids: readonly BookLevel[], wantLots: bigint, cashUnit: bigint): WalkedExit | null {
  if (wantLots <= 0n || cashUnit <= 0n) return null;
  const { proceeds, filled } = exitWalk(bids, wantLots);
  const lots = filled < wantLots ? filled : wantLots;
  if (lots === 0n) return null;
  const priceTicks = Number(proceeds / lots);
  if (priceTicks < 1 || priceTicks > 999) return null;
  return { lots, priceTicks, proceedsBase: lots * BigInt(priceTicks) * cashUnit };
}

/**
 * Which legs a buy-back of `lots` takes, and how many lots of each: largest legs first, whole legs while they fit, then
 * part of the next (a partial buy-back, `sellLots`). At most `maxLegs` legs; fewer lots when they run out. Pure.
 */
export function allocateLegs<L extends { cid: string; lots: bigint }>(legs: readonly L[], lots: bigint, maxLegs: number): Array<{ leg: L; sell: bigint }> {
  const out: Array<{ leg: L; sell: bigint }> = [];
  let left = lots;
  const sorted = [...legs].sort((a, b) => (a.lots === b.lots ? a.cid.localeCompare(b.cid) : a.lots > b.lots ? -1 : 1));
  for (const leg of sorted) {
    if (left <= 0n || out.length >= maxLegs) break;
    const sell = leg.lots < left ? leg.lots : left;
    out.push({ leg, sell });
    left -= sell;
  }
  return out;
}
