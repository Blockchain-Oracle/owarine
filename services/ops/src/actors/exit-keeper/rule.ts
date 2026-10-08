/**
 * The exit keeper's rule (R2, revamp step 4), pure: what the venue does with one seat's `RestingExit` given the live
 * spot and its own bid ladder. Nothing here reads the ledger or the clock.
 *
 *   trail    the level follows the best spot since the exit was armed, `trailBps` behind it (in the position's favour
 *            only: up for an Up leg, down for a Down leg). The keeper triggers on its in-memory level at once; the
 *            ledger's level (`RestExit_Ratchet`) follows it in steps, so a restart never loses more than one step.
 *   stop     hit when the spot crosses the level against the position (an Up leg: spot ≤ level).
 *   take     hit when the venue's bid for the held side reaches `takeProfitTicks`.
 *   fill     on a hit, the venue buys back at its own bid ladder, never below the exit's floor (nor the take-profit
 *            when that is the only trigger): only the levels at or above it count, so a thin book fills part and the
 *            rest keeps resting. A hit with nothing at or above the floor holds (a gap through the floor).
 */
import type { BookLevel } from "@owarine/core/market";
import { walkExit, type RestingExitC } from "@owarine/markets/ops/canton";

export const BPS = 10_000n;

/** The trail's in-memory state for one exit (by owner + exitRef, which survive a ratchet's new contract id). */
export interface TrailMemory {
  /** The best spot seen since the exit was armed (or, after a restart, the best its ledger level implies). */
  peakE8: bigint;
  /** When the ledger level last moved (ms), for the ratchet's spacing. */
  lastRatchetMs: number;
}

/** The best spot a ledger level implies: `stop = peak × (1 ∓ bps)`. */
export function impliedPeak(outcome: RestingExitC["outcome"], stopE8: bigint, trailBps: number): bigint {
  const b = BigInt(trailBps);
  return outcome === "SideUp" ? (stopE8 * BPS) / (BPS - b) : (stopE8 * BPS) / (BPS + b);
}

/** The level `trailBps` behind a peak, rounded in the owner's favour by under one unit. */
export function levelBehind(outcome: RestingExitC["outcome"], peakE8: bigint, trailBps: number): bigint {
  const b = BigInt(trailBps);
  return outcome === "SideUp" ? (peakE8 * (BPS - b)) / BPS : (peakE8 * (BPS + b) + BPS - 1n) / BPS;
}

const better = (outcome: RestingExitC["outcome"], a: bigint, b: bigint): boolean => (outcome === "SideUp" ? a > b : a < b);

/** The peak after this spot: the better of the two for the held side. */
export const nextPeak = (outcome: RestingExitC["outcome"], peakE8: bigint, spotE8: bigint): bigint => (better(outcome, spotE8, peakE8) ? spotE8 : peakE8);

/** The level the keeper triggers on now: the ledger's, or the trail's from the peak when that is in the owner's favour. */
export function effectiveStop(x: RestingExitC, peakE8: bigint | null): bigint | null {
  if (!x.stop) return null;
  if (x.stop.trailBps === null || peakE8 === null) return x.stop.stopE8;
  const trailed = levelBehind(x.outcome, peakE8, x.stop.trailBps);
  return better(x.outcome, trailed, x.stop.stopE8) ? trailed : x.stop.stopE8;
}

export const stopHit = (outcome: RestingExitC["outcome"], stopE8: bigint, spotE8: bigint): boolean => (outcome === "SideUp" ? spotE8 <= stopE8 : spotE8 >= stopE8);

/** The ladder's bid levels at or above `minTicks`, best first: what the venue may sell into without breaking the floor. */
export const levelsAtOrAbove = (bids: readonly BookLevel[], minTicks: number): BookLevel[] => bids.filter(([t]) => t >= minTicks);

export type ExitDecision =
  | { kind: "wait"; why: string }
  /** A trigger fired but nothing on the ladder pays the floor: the exit holds until something does. */
  | { kind: "hold"; why: string }
  | { kind: "fill"; trigger: "stop" | "take-profit" | "close"; lots: bigint; priceTicks: number; proceedsBase: bigint };

/**
 * Whether to fill `x` now, for at most `held` lots, given the spot, the trail's level and the venue's bids for the held
 * side (best first). `close` is the seat's own Close tap on an armed exit: it fills at the bid, but never below
 * `minProceedsBase` (what the seat was shown, less its slippage) or the floor.
 */
export function decideExit(input: {
  exit: RestingExitC;
  held: bigint;
  spotE8: bigint | null;
  stopE8: bigint | null;
  bids: readonly BookLevel[];
  close?: { minProceedsBase: bigint };
}): ExitDecision {
  const { exit: x, held, bids } = input;
  const want = x.lots < held ? x.lots : held;
  if (want <= 0n) return { kind: "wait", why: "nothing held on the exit's side" };
  const best = bids[0]?.[0] ?? 0;

  let trigger: "stop" | "take-profit" | "close" | null = null;
  if (input.close) trigger = "close";
  else if (input.stopE8 !== null && input.spotE8 !== null && stopHit(x.outcome, input.stopE8, input.spotE8)) trigger = "stop";
  else if (x.takeProfitTicks !== null && best >= x.takeProfitTicks) trigger = "take-profit";
  if (!trigger) return { kind: "wait", why: input.spotE8 === null && x.stop ? "no fresh spot" : "not triggered" };

  // With a take-profit as the only trigger, its price is the floor the ledger holds the fill to.
  const minTicks = x.stop === null && x.takeProfitTicks !== null ? Math.max(x.floorTicks, x.takeProfitTicks) : x.floorTicks;
  const walked = walkExit(levelsAtOrAbove(bids, minTicks), want, x.cashUnit);
  if (!walked || walked.priceTicks < minTicks) return { kind: "hold", why: `${trigger} hit, but no bid at or above ${minTicks}` };
  if (input.close && walked.proceedsBase < input.close.minProceedsBase) {
    return { kind: "hold", why: `close pays ${walked.proceedsBase}, below the ${input.close.minProceedsBase} confirmed` };
  }
  return { kind: "fill", trigger, lots: walked.lots, priceTicks: walked.priceTicks, proceedsBase: walked.proceedsBase };
}

/**
 * Whether the ledger's trail level should move to `level` now: in the owner's favour, by at least half the trail
 * distance of the spot (so a slow drift is one write, not one per tick), and no sooner than `minGapMs` after the last.
 */
export function shouldRatchet(x: RestingExitC, level: bigint, nowMs: number, lastRatchetMs: number, minGapMs: number): boolean {
  if (!x.stop || x.stop.trailBps === null) return false;
  if (!better(x.outcome, level, x.stop.stopE8)) return false;
  if (nowMs - lastRatchetMs < minGapMs) return false;
  const step = (x.stop.stopE8 * BigInt(x.stop.trailBps)) / (2n * BPS);
  const moved = x.outcome === "SideUp" ? level - x.stop.stopE8 : x.stop.stopE8 - level;
  return moved >= (step > 0n ? step : 1n);
}
