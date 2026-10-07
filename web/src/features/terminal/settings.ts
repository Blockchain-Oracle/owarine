"use client";

import { DEFAULT_SLIPPAGE_BPS } from "@owarine/markets/react";
import { useSyncExternalStore } from "react";

/**
 * The terminal's own settings (Tradash's settings sheet): Close tolerance and order size, per browser. Kept in
 * localStorage behind try/catch (a private window or blocked storage just uses the defaults); sounds keep their own
 * mute in `lib/sound/trade.ts`.
 */
export interface TradeSettings {
  /** How far under the live exit a firm Close may land without asking, bps. */
  slippageBps: number;
  /** The default stake for UP / DOWN, in whole credits. */
  sizeCredits: number;
}

const KEY = "owarine.trade.settings";
export const SLIPPAGE_CHOICES_BPS = [50, 100, 200, 500] as const;
export const SIZE_CHOICES = [5, 10, 25, 50, 100] as const;
const DEFAULTS: TradeSettings = { slippageBps: DEFAULT_SLIPPAGE_BPS, sizeCredits: 10 };

const listeners = new Set<() => void>();
let current: TradeSettings = read();

function read(): TradeSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TradeSettings>;
    const slippageBps = typeof parsed.slippageBps === "number" && parsed.slippageBps >= 0 && parsed.slippageBps <= 2_000 ? parsed.slippageBps : DEFAULTS.slippageBps;
    const sizeCredits = typeof parsed.sizeCredits === "number" && parsed.sizeCredits > 0 && parsed.sizeCredits <= 1_000_000 ? parsed.sizeCredits : DEFAULTS.sizeCredits;
    return { slippageBps, sizeCredits };
  } catch {
    return DEFAULTS;
  }
}

export function setTradeSettings(next: Partial<TradeSettings>): void {
  current = { ...current, ...next };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage blocked: the setting lasts for this tab.
  }
  listeners.forEach((l) => l());
}

export function useTradeSettings(): TradeSettings {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => DEFAULTS,
  );
}
