import type { ParlayQuote } from "@owarine/core/parlay";
import type { Side } from "@owarine/core/types";
import { parlayParams, priceParlay, type ParlayPriced, type TicketWindow } from "@owarine/markets/parlay";
import { fairNow, repriceLadder, type Ladder } from "@owarine/markets/runtime";

/**
 * A parlay on the trading screen, priced and marked off the ladders the screen already streams (plan 2c). The price is
 * the reserve's own: ops' `priceParlay` with its `parlayParams`, over each leg's ladder re-priced at the live spot — the
 * same kernel ops issues with, so the number on the button is the number the reserve quotes, or a requote inside the
 * slippage tolerance. A live ticket can't be sold back, so it is marked at fair value: its payout times each open leg's
 * chance, from the fair model the ladder carries.
 */

export interface LegFeed {
  ladder: Ladder | null;
  side: Side;
  spotE8: bigint | null;
}

export type ParlayEstimate = { ok: true; quote: ParlayQuote } | { ok: false; why: string; legIdx: number | null };

const quoting = (ladder: Ladder | null, nowSec: number): ladder is Ladder => ladder !== null && ladder.state === "quoting" && nowSec <= ladder.quotingUntilSec;

/** One leg's ladder as the reserve's `TicketWindow`, its levels moved to the live spot. */
export function ticketWindowOf(ladder: Ladder, spotE8: bigint | null, nowSec: number): TicketWindow {
  const levels = repriceLadder(ladder, spotE8, nowSec);
  return {
    termsCid: ladder.termsCid,
    marketId: ladder.marketId,
    damlMarketId: ladder.damlMarketId,
    symbol: ladder.symbol ?? "",
    openPriceE8: ladder.openPriceE8 ?? 0n,
    fairTicks: levels.fairTicks ?? 500,
    lockAtSec: ladder.lockAtSec,
    expirySec: ladder.expirySec,
    cashUnit: ladder.cashUnit,
    up: levels.up,
    down: levels.down,
  };
}

/** The ticket a stake buys right now, or why the reserve would not sell it, in words. */
export function estimateParlay(legs: readonly LegFeed[], stakeBase: bigint, nowSec: number): ParlayEstimate {
  if (legs.length < 2) return { ok: false, why: legs.length === 0 ? "Add two or three markets" : "Add one more market", legIdx: null };
  if (stakeBase <= 0n) return { ok: false, why: "Enter a stake", legIdx: null };
  const windows: Array<{ window: TicketWindow; side: Side }> = [];
  for (const [i, leg] of legs.entries()) {
    if (!quoting(leg.ladder, nowSec)) return { ok: false, why: "Waiting for a price on this market", legIdx: i };
    windows.push({ window: ticketWindowOf(leg.ladder, leg.spotE8, nowSec), side: leg.side });
  }
  const priced = priceParlay(windows, { kind: "fixStake", stakeBase }, parlayParams(), nowSec);
  return priced.ok ? priced : { ok: false, ...refusalWords(priced.refusal) };
}

type Refusal = Extract<ParlayPriced, { ok: false }>["refusal"];

export function refusalWords(r: Refusal): { why: string; legIdx: number | null } {
  switch (r.kind) {
    case "legs":
      return { why: `A parlay holds ${r.min} or ${r.max} markets`, legIdx: null };
    case "thin-book":
      return { why: "Not enough on offer at this size. Try a smaller stake", legIdx: r.legIdx };
    case "long-shot":
      return { why: "Too long a shot for the reserve. Swap a leg", legIdx: null };
    case "underpriced":
    case "zero":
      return { why: "Stake too small to price", legIdx: null };
    case "over-payout-cap":
      return { why: `Pays more than the ${Number(r.capBase) / 1e6} cap. Lower the stake`, legIdx: null };
    case "too-late":
      return { why: "Closes too soon to join a parlay", legIdx: r.legIdx };
    case "duplicate-leg":
      return { why: "Two legs name the same Window", legIdx: null };
  }
}

/** The chance a leg lands now (0–1): the fair the pricer would quote at the live spot, else the ladder's own; null with no ladder. */
export function legChance(ladder: Ladder | null, side: Side, spotE8: bigint | null, nowSec: number): number | null {
  if (!ladder) return null;
  const fair = fairNow(ladder, spotE8, nowSec) ?? (typeof ladder.fairTicks === "number" ? ladder.fairTicks : null);
  if (fair === null) return null;
  const up = fair / 1000;
  return side === "up" ? up : 1 - up;
}

/** Whether a leg is ahead of its line at this spot (a tie goes Up, as the Window settles). */
export function legLead(side: Side, spot: number | null, line: number | null): "ahead" | "behind" | null {
  if (spot === null || line === null || !(line > 0)) return null;
  const upAhead = spot >= line;
  return (side === "up") === upAhead ? "ahead" : "behind";
}

export type LegStatus = "pending" | "won" | "lost" | "void";

/**
 * A ticket's value now, in base units: a void leg voids the ticket (the stake back), a lost leg loses it, else the
 * payout times every open leg's chance (its price at entry when no live chance is known).
 */
export function markParlay(legs: ReadonlyArray<{ status: LegStatus; chance: number | null; entryChance: number }>, stakeBase: bigint, maxPayoutBase: bigint): number {
  if (legs.some((l) => l.status === "void")) return Number(stakeBase);
  if (legs.some((l) => l.status === "lost")) return 0;
  let p = 1;
  for (const l of legs) if (l.status === "pending") p *= clamp01(l.chance ?? l.entryChance);
  return Number(maxPayoutBase) * p;
}

/** How a ticket stands: decided once a leg is void or lost, or every leg has won. */
export function parlayOutcome(legs: ReadonlyArray<{ status: LegStatus }>): "live" | "won" | "lost" | "void" {
  if (legs.some((l) => l.status === "void")) return "void";
  if (legs.some((l) => l.status === "lost")) return "lost";
  return legs.length > 0 && legs.every((l) => l.status === "won") ? "won" : "live";
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
