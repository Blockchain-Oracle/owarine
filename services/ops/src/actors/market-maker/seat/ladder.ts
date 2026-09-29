/**
 * The venue price ladder (plan §6): the seed maker's two-sided quote, re-meant for Canton. The inner prices are the
 * unchanged `quotePair` around the unchanged `fairYesTicks`; the ladder adds depth behind them, `levels` steps of
 * `stepTicks`, each up to `lotsPerLevel`, until the per-market venue-stake cap for that side is used up.
 *
 * Both sides are in their own outcome's terms, best first, as core `BookLevel[]`: `up` is what buying Up costs
 * (the YES ask and above), `down` what buying Down costs (1000 − the YES bid, and above). A user buying Up at `p`
 * makes the venue lock `(1000 − p) × cashUnit` per lot, which is what the cap counts. Pure and integer.
 */
import type { BookLevel } from "@agari/core/market";
import { quotePair } from "./quote";

export interface LadderInput {
  fairTicks: number;
  halfSpreadTicks: number;
  minTick: number;
  levels: number;
  stepTicks: number;
  lotsPerLevel: bigint;
  cashUnit: bigint;
  /** Per side: the most venue stake this market may hold against users on that side. */
  capBase: bigint;
  /** Per side: venue stake already committed (venue legs and live quotes against that side). */
  usedUpBase: bigint;
  usedDownBase: bigint;
}

export interface Ladder {
  up: BookLevel[];
  down: BookLevel[];
}

function side(bestTicks: number | null, input: LadderInput, usedBase: bigint): BookLevel[] {
  if (bestTicks === null) return [];
  const out: BookLevel[] = [];
  let room = input.capBase - usedBase;
  for (let k = 0; k < input.levels && room > 0n; k++) {
    const ticks = bestTicks + k * input.stepTicks;
    if (ticks > 1000 - input.minTick) break;
    const stakePerLot = BigInt(1000 - ticks) * input.cashUnit;
    const affordable = room / stakePerLot;
    const lots = affordable < input.lotsPerLevel ? affordable : input.lotsPerLevel;
    if (lots <= 0n) break;
    out.push([ticks, lots]);
    room -= lots * stakePerLot;
  }
  return out;
}

export function buildLadder(input: LadderInput): Ladder {
  const pair = quotePair({ fairTicks: input.fairTicks, halfSpreadTicks: input.halfSpreadTicks, minTick: input.minTick, bestBidTicks: null, bestAskTicks: null });
  return {
    up: side(pair.askTicks, input, input.usedUpBase),
    down: side(pair.bidTicks === null ? null : 1000 - pair.bidTicks, input, input.usedDownBase),
  };
}

/** The last second a Window takes new quotes: never in its final minute (scaled down for a lane shorter than 4 minutes), never past lock. */
export function quotingUntilSec(w: { tradingStartSec: number; lockAtSec: number; expirySec: number }): number {
  const tailSec = Math.min(60, Math.floor((w.expirySec - w.tradingStartSec) / 4));
  return Math.min(w.lockAtSec, w.expirySec - tailSec);
}
