"use client";

import { PARLAY_MAX_LEGS } from "@owarine/core/parlay";
import type { EventMarket, Side } from "@owarine/core/types";
import { useSyncExternalStore } from "react";

/**
 * The parlay slip (plan 2c): the trading screen's second way to trade. In Parlay mode UP and DOWN add the Window on
 * screen to the slip instead of opening it; the slip survives moving between markets and a reload, so a ticket can name
 * BTC, then ETH, then CC. A leg names one Window; when that Window gets too close to its close to join a ticket, the leg
 * moves to the next Window on the same lane (the one the screen would show), as `/parlay`'s builder does.
 */
export interface SlipLeg {
  marketId: string;
  asset: string;
  intervalSec: number;
  side: Side;
  expirySec: number;
  lockAtSec: number;
  poolAddress: string;
  decimals: number;
}

interface SlipState {
  on: boolean;
  legs: SlipLeg[];
  /** The slip's own stake in credits; null follows the screen's size. */
  stakeCredits: number | null;
}

/** The reserve refuses a leg with less than this left (`parlayParams().minTimeLeftSec`), and a quote must outlive 5 s before lock. */
export const LEG_MIN_LEFT_SEC = 25;
const LEG_MIN_TO_LOCK_SEC = 5;

const KEY = "owarine.trade.parlay.v1";
const INITIAL: SlipState = { on: false, legs: [], stakeCredits: null };
const listeners = new Set<() => void>();
let state: SlipState = INITIAL;
let hydrated = false;

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<SlipState>;
    state = {
      on: p.on === true,
      legs: Array.isArray(p.legs) ? p.legs.filter(isLeg).slice(0, PARLAY_MAX_LEGS) : [],
      stakeCredits: typeof p.stakeCredits === "number" && p.stakeCredits > 0 ? p.stakeCredits : null,
    };
  } catch {
    state = INITIAL;
  }
}

function isLeg(l: unknown): l is SlipLeg {
  const x = l as SlipLeg;
  return typeof x?.marketId === "string" && typeof x.asset === "string" && (x.side === "up" || x.side === "down") && Number.isFinite(x.expirySec) && Number.isFinite(x.lockAtSec);
}

function commit(next: SlipState): void {
  state = next;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the slip lasts for this tab.
  }
  listeners.forEach((l) => l());
}

export function useSlip(): SlipState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (hydrate(), state),
    () => INITIAL,
  );
}

export function setParlayOn(on: boolean): void {
  hydrate();
  commit({ ...state, on });
}

export function setSlipStake(stakeCredits: number | null): void {
  hydrate();
  commit({ ...state, stakeCredits });
}

export function removeLeg(marketId: string): void {
  hydrate();
  commit({ ...state, legs: state.legs.filter((l) => l.marketId !== marketId) });
}

export function clearSlip(): void {
  hydrate();
  commit({ ...state, legs: [] });
}

export type ToggleResult = "added" | "flipped" | "removed" | "full";

/** UP/DOWN in Parlay mode on a Window: add it, flip its side, or (the same side again) take it off. */
export function toggleLeg(market: Pick<EventMarket, "marketId" | "asset" | "intervalSec" | "expirySec" | "lockAtSec" | "poolAddress" | "decimals">, side: Side): ToggleResult {
  hydrate();
  const next = toggledLegs(state.legs, legOf(market, side));
  if (next.result !== "full") commit({ ...state, legs: next.legs });
  return next.result;
}

export function legOf(m: Pick<EventMarket, "marketId" | "asset" | "intervalSec" | "expirySec" | "lockAtSec" | "poolAddress" | "decimals">, side: Side): SlipLeg {
  return { marketId: m.marketId, asset: m.asset, intervalSec: m.intervalSec, side, expirySec: m.expirySec, lockAtSec: m.lockAtSec, poolAddress: m.poolAddress, decimals: m.decimals };
}

export function toggledLegs(legs: readonly SlipLeg[], leg: SlipLeg, max = PARLAY_MAX_LEGS): { legs: SlipLeg[]; result: ToggleResult } {
  const at = legs.findIndex((l) => l.marketId === leg.marketId);
  if (at >= 0) {
    if (legs[at]!.side === leg.side) return { legs: legs.filter((_, i) => i !== at), result: "removed" };
    return { legs: legs.map((l, i) => (i === at ? { ...l, side: leg.side } : l)), result: "flipped" };
  }
  if (legs.length >= max) return { legs: [...legs], result: "full" };
  return { legs: [...legs, leg], result: "added" };
}

/** A leg can still join a ticket: enough time before its close for the reserve, and before its lock for a quote. */
export const legOpen = (l: Pick<SlipLeg, "expirySec" | "lockAtSec">, nowSec: number): boolean => l.expirySec - nowSec >= LEG_MIN_LEFT_SEC && l.lockAtSec - nowSec >= LEG_MIN_TO_LOCK_SEC;

/**
 * Moves every leg whose Window can no longer join a ticket to the next one on its lane that can: quoted first, and of
 * those the one with the most time left (the Window the screen shows); a Window another leg holds is skipped. A leg
 * with no successor yet stays as it is (the slip says it closes too soon). Returns the same array when nothing moved.
 */
export function rolledLegs(
  legs: readonly SlipLeg[],
  markets: readonly EventMarket[],
  nowSec: number,
  isQuoting: (marketId: string) => boolean,
  /** The Window's quote cut-off has passed: no ticket can price it again, though it has not closed yet. */
  pastQuote: (marketId: string) => boolean = () => false,
): { legs: readonly SlipLeg[]; moved: SlipLeg[] } {
  const used = new Set(legs.map((l) => l.marketId));
  const moved: SlipLeg[] = [];
  const next = legs.map((leg) => {
    if (legOpen(leg, nowSec) && !pastQuote(leg.marketId)) return leg;
    const candidates = markets
      .filter((m) => m.asset === leg.asset && m.intervalSec === leg.intervalSec && m.kind !== "event" && !m.voided && !used.has(m.marketId) && m.tradingStartSec <= nowSec && legOpen(m, nowSec) && !pastQuote(m.marketId))
      .sort((a, b) => Number(isQuoting(b.marketId)) - Number(isQuoting(a.marketId)) || b.expirySec - a.expirySec);
    const pick = candidates[0];
    if (!pick) return leg;
    used.add(pick.marketId);
    const rolled = legOf(pick, leg.side);
    moved.push(rolled);
    return rolled;
  });
  return moved.length ? { legs: next, moved } : { legs, moved };
}

export function rollSlip(markets: readonly EventMarket[], nowSec: number, isQuoting: (marketId: string) => boolean, pastQuote?: (marketId: string) => boolean): SlipLeg[] {
  hydrate();
  const r = rolledLegs(state.legs, markets, nowSec, isQuoting, pastQuote);
  if (r.moved.length) commit({ ...state, legs: [...r.legs] });
  return r.moved;
}
