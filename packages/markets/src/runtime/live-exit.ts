/**
 * Live exit value (revamp step 2, Tradash's breathing PnL): what Close would pay for a held side right now, and the
 * PnL against what it cost. Pure and integer apart from the fair model's floats.
 *
 * One kernel with the venue: the exit is ops' own `walkExit(bidLevels(ladder, side), lots, cashUnit)` (the exit
 * issuer's walk: one price for every lot, the average floored, no exit fee), over the published ladder. Between ladder
 * events the ladder is re-priced, not guessed: core `fairYesTicks` with the live spot and the model the ladder carries
 * (σ, its year, the Window's open print and expiry) gives the fair the pricer would compute now, and every level moves
 * by that change in fair (Up costs rise by Δ, Down costs fall by Δ). When the live spot is the one the ladder was priced
 * on, Δ = 0 and the number is exactly the firm exit the venue would issue. A ladder without a model (gap, event, an
 * older ops) is walked as published.
 */
import { fairYesTicks, type BookLevel } from "@owarine/core/market";
import { bidLevels, walkExit } from "../ops/canton/quote-walk";
import type { Ladder } from "./ladder";

const PAIR_TICKS = 1000;

/** Re-priced levels of one ladder (same lots, prices shifted by `Δfair`), and the fair they now stand on. */
export interface RepricedLadder {
  up: BookLevel[];
  down: BookLevel[];
  fairTicks: number | null;
  /** The fair moved since the ladder was published (0 when re-pricing did not apply). */
  shiftTicks: number;
}

/** The fair the pricer would quote now for this ladder's Window, or null when the ladder carries no spot model. */
export function fairNow(ladder: Ladder, spotE8: bigint | null, nowSec: number): number | null {
  if (spotE8 === null || spotE8 <= 0n || typeof ladder.sigmaBps !== "number" || typeof ladder.yearSec !== "number" || !ladder.openPriceE8 || ladder.openPriceE8 <= 0n) return null;
  return fairYesTicks({
    spotE8, openE8: ladder.openPriceE8, secondsLeft: ladder.expirySec - nowSec, sigmaBps: ladder.sigmaBps, yearSec: ladder.yearSec, minTick: ladder.minTick ?? 1,
  });
}

function shift(levels: readonly (readonly [number, bigint])[], by: number, minTick: number): BookLevel[] {
  const out: BookLevel[] = [];
  for (const [ticks, lots] of levels) {
    const t = ticks + by;
    if (t < minTick || t > PAIR_TICKS - minTick) continue;
    out.push([t, lots]);
  }
  return out;
}

export function repriceLadder(ladder: Ladder, spotE8: bigint | null, nowSec: number): RepricedLadder {
  const published = typeof ladder.fairTicks === "number" ? ladder.fairTicks : null;
  const now = published === null ? null : fairNow(ladder, spotE8, nowSec);
  if (now === null || published === null || now === published) {
    return { up: ladder.up.map(([t, l]) => [t, l]), down: ladder.down.map(([t, l]) => [t, l]), fairTicks: published, shiftTicks: 0 };
  }
  const delta = now - published;
  const minTick = ladder.minTick ?? 1;
  return { up: shift(ladder.up, delta, minTick), down: shift(ladder.down, -delta, minTick), fairTicks: now, shiftTicks: delta };
}

export interface HeldSides {
  /** Lots held on each side (contracts ÷ (1000 × cashUnit)). */
  upLots: bigint;
  downLots: bigint;
}

export interface LiveExit {
  /** What Close pays for everything held, base units; 0 when nothing would fill. */
  exitBase: bigint;
  /** Lots the walk can fill (≤ held); below held means Close sells part and keeps the rest. */
  fillableLots: bigint;
  heldLots: bigint;
  /** Per side, the walk's single price in that side's own ticks (null: that side has nothing to sell or no bids). */
  upPriceTicks: number | null;
  downPriceTicks: number | null;
  /** True when the ladder is closed or nothing fills: the position pays at settlement, Close is unavailable. */
  locked: boolean;
}

/** Close's proceeds for held lots on the (re-priced) ladder: the exit issuer's walk per side, summed. */
export function liveExit(levels: { up: readonly BookLevel[]; down: readonly BookLevel[] }, held: HeldSides, cashUnit: bigint, quoting: boolean): LiveExit {
  const heldLots = held.upLots + held.downLots;
  const up = quoting && held.upLots > 0n ? walkExit(bidLevels(levels, "up"), held.upLots, cashUnit) : null;
  const down = quoting && held.downLots > 0n ? walkExit(bidLevels(levels, "down"), held.downLots, cashUnit) : null;
  const fillableLots = (up?.lots ?? 0n) + (down?.lots ?? 0n);
  return {
    exitBase: (up?.proceedsBase ?? 0n) + (down?.proceedsBase ?? 0n),
    fillableLots,
    heldLots,
    upPriceTicks: up?.priceTicks ?? null,
    downPriceTicks: down?.priceTicks ?? null,
    locked: !quoting || (heldLots > 0n && fillableLots === 0n),
  };
}

/** Lots from a position's contracts on one side (`contractsOf` inverted; the cash unit is the Window's). */
export const lotsOf = (contractsRaw: bigint, cashUnit: bigint): bigint => (cashUnit > 0n ? contractsRaw / (BigInt(PAIR_TICKS) * cashUnit) : 0n);

export interface LivePnl extends LiveExit {
  costBasisBase: bigint;
  /** `exitBase − costBasisBase` over the lots Close can sell; the rest is valued at its cost (it pays at settlement). */
  pnlBase: bigint;
  /** The fair the number stands on, and how far it moved since the ladder was published. */
  fairTicks: number | null;
  shiftTicks: number;
}

/**
 * A position's live PnL: Close's proceeds now minus its cost basis (backing + fee paid). A partly fillable position
 * counts only the sold part's cost (`cost × fillable ÷ held`), so a thin ladder never reads as a loss it would not take.
 */
export function livePnl(input: { ladder: Ladder; spotE8: bigint | null; nowSec: number; upContractsRaw: bigint; downContractsRaw: bigint; costBasisBase: bigint }): LivePnl {
  const { ladder } = input;
  const levels = repriceLadder(ladder, input.spotE8, input.nowSec);
  const quoting = ladder.state === "quoting" && input.nowSec <= ladder.quotingUntilSec;
  const exit = liveExit(levels, { upLots: lotsOf(input.upContractsRaw, ladder.cashUnit), downLots: lotsOf(input.downContractsRaw, ladder.cashUnit) }, ladder.cashUnit, quoting);
  const soldCost = exit.heldLots === 0n ? 0n : (input.costBasisBase * exit.fillableLots) / exit.heldLots;
  return { ...exit, costBasisBase: input.costBasisBase, pnlBase: exit.fillableLots === 0n ? 0n : exit.exitBase - soldCost, fairTicks: levels.fairTicks, shiftTicks: levels.shiftTicks };
}
