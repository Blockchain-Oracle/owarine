"use client";

import { DEFAULT_SLIPPAGE_BPS } from "@owarine/markets/react";
import { useSyncExternalStore } from "react";
import { CANDLE_INTERVALS, type CandleInterval } from "./chart/candles";

/**
 * The trading screen's settings, to Tradash's (`settings` slice; TRADASH-FIDELITY.md §Sheets): one object, persisted per
 * browser behind try/catch (a private window simply uses the defaults). Size is the stake in credits; while untouched it
 * follows 5 % of what is available, as the reference re-derives it on every balance change.
 */
export interface TradeSettings {
  /** The stake once the user set one; null while it follows 5 % of available. */
  sizeCredits: number | null;
  /** Trail distance as a fraction (0.001 = 0.10 %). */
  trailPct: number;
  /** How far under the live exit a firm Close may land without asking (step 2), bps. */
  slippageBps: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** Emoji callouts and the edge flash (sounds and haptics play regardless). */
  reactionsEnabled: boolean;
  musicEnabled: boolean;
  musicTrack: MusicTrack;
  tutorialSeen: boolean;
  favourites: string[];
  /** Tradash's chart view and candle interval (picking an interval switches to candles). */
  chartView: "line" | "candles";
  chartInterval: CandleInterval;
}

export type MusicTrack = "arcade" | "rush" | "night";
export const MUSIC_TRACKS: readonly MusicTrack[] = ["arcade", "rush", "night"];
export const TRAIL_CHOICES = [0.001, 0.005, 0.01, 0.02] as const;
export const TRAIL_MIN = 0.001;
export const TRAIL_MAX = 0.1;
export const SLIPPAGE_CHOICES_BPS = [50, 100, 200, 500] as const;
/** Default stake: this share of available (Tradash's 5 %), never under the minimum. */
export const DEFAULT_SIZE_SHARE = 0.05;

const KEY = "owarine.trade.settings.v1";
const DEFAULTS: TradeSettings = {
  sizeCredits: null, trailPct: 0.001, slippageBps: DEFAULT_SLIPPAGE_BPS, soundEnabled: true, hapticsEnabled: true, reactionsEnabled: true,
  musicEnabled: false, musicTrack: "arcade", tutorialSeen: false, favourites: [], chartView: "line", chartInterval: "1m",
};

const listeners = new Set<() => void>();
let current: TradeSettings = DEFAULTS;
let hydrated = false;

const num = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function read(): TradeSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<TradeSettings>;
    return {
      sizeCredits: num(p.sizeCredits, 0.000001, 1e9) ? p.sizeCredits : null,
      trailPct: num(p.trailPct, TRAIL_MIN, TRAIL_MAX) ? p.trailPct : DEFAULTS.trailPct,
      slippageBps: num(p.slippageBps, 0, 2_000) ? p.slippageBps : DEFAULTS.slippageBps,
      soundEnabled: typeof p.soundEnabled === "boolean" ? p.soundEnabled : true,
      hapticsEnabled: typeof p.hapticsEnabled === "boolean" ? p.hapticsEnabled : true,
      reactionsEnabled: typeof p.reactionsEnabled === "boolean" ? p.reactionsEnabled : true,
      musicEnabled: typeof p.musicEnabled === "boolean" ? p.musicEnabled : false,
      musicTrack: MUSIC_TRACKS.includes(p.musicTrack as MusicTrack) ? (p.musicTrack as MusicTrack) : "arcade",
      tutorialSeen: p.tutorialSeen === true,
      favourites: Array.isArray(p.favourites) ? p.favourites.filter((s): s is string => typeof s === "string").slice(0, 100) : [],
      chartView: p.chartView === "candles" ? "candles" : "line",
      chartInterval: CANDLE_INTERVALS.includes(p.chartInterval as CandleInterval) ? (p.chartInterval as CandleInterval) : "1m",
    };
  } catch {
    return DEFAULTS;
  }
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  current = read();
}

export function setTradeSettings(next: Partial<TradeSettings>): void {
  hydrate();
  current = { ...current, ...next };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage blocked: the setting lasts for this tab.
  }
  listeners.forEach((l) => l());
}

export function tradeSettings(): TradeSettings {
  hydrate();
  return current;
}

/** Null before the browser's settings are read (server render and the first client pass), then the settings. */
export function useTradeSettingsState(): TradeSettings | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (hydrated ? current : (hydrate(), current)),
    () => null,
  );
}

export function useTradeSettings(): TradeSettings {
  return useTradeSettingsState() ?? DEFAULTS;
}

/** The stake a tap uses: the set size, or 5 % of available (never below `min`), capped at what is available. */
export function stakeFor(settings: Pick<TradeSettings, "sizeCredits">, availableCredits: number | null, minCredits: number): number {
  const auto = Math.max(minCredits, DEFAULT_SIZE_SHARE * (availableCredits ?? 0));
  const want = settings.sizeCredits ?? auto;
  return Math.round(want * 1e4) / 1e4;
}
