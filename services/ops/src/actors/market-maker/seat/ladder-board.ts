/**
 * The process's venue price ladders, one per quoting Window: the pricer writes, the quote issuer walks, and
 * `/ladders/stream` publishes. In memory only; the pricer rebuilds every entry within one pass after a restart.
 *
 * `marketId` is the app's id (`@owarine/core` `marketIdFromDaml` of the terms' `damlMarketId`), the one the web keys
 * every Window on and sends back in `POST /internal/quotes`; `seriesId` is `seriesIdFromDaml(seriesKey)`.
 *
 * Wire shape (`/ladders/latest`, `event: ladder` on `/ladders/stream`), integers as decimal strings where they may
 * exceed 2^53: `{ marketId, damlMarketId, seriesId, termsCid, seriesKey, symbol, index, tradingStartSec, lockAtSec, expirySec, quotingUntilSec,
 * cashUnit, feeRateBps, fairTicks, openPriceE8, spotE8, up: [[ticks, "lots"], …], down: […], asOfMs, state }` where
 * `up`/`down` are core `BookLevel[]` best first, in the bought outcome's own terms. `state: "closed"` is sent once when a
 * Window stops quoting, and the entry is dropped.
 *
 * Revamp step 2: the model behind the price rides along (`sigmaBps`, `yearSec`, `minTick`, `halfSpreadTicks`; null σ
 * for a Window not priced off spot), so a client can re-price the ladder with core `fairYesTicks` and the live spot
 * between events. `put` emits only when what a client walks changed (levels, fair, state, quoting end): a pass that
 * re-derives the same ladder is silent, so the stream carries changes, not a 1 Hz echo.
 */
import type { BookLevel } from "@owarine/core/market";

export interface LadderEntry {
  /** The app's base58 market id. */
  marketId: string;
  /** The terms' own `marketId` (`BTC-1m:42`). */
  damlMarketId: string;
  /** The app's Series id. */
  seriesId: string;
  termsCid: string;
  seriesKey: string;
  symbol: string;
  index: number;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  quotingUntilSec: number;
  cashUnit: bigint;
  feeRateBps: number;
  fairTicks: number;
  /** The fair model's inputs at `fairTicks`; σ null when the Window is not priced off spot (gap, event). */
  sigmaBps: number | null;
  yearSec: number | null;
  minTick: number;
  halfSpreadTicks: number;
  openPriceE8: bigint;
  spotE8: bigint;
  up: BookLevel[];
  down: BookLevel[];
  asOfMs: number;
  state: "quoting" | "closed";
}

export type WireLadder = Omit<LadderEntry, "cashUnit" | "openPriceE8" | "spotE8" | "up" | "down"> & {
  cashUnit: string;
  openPriceE8: string;
  spotE8: string;
  up: Array<[number, string]>;
  down: Array<[number, string]>;
};

export const toWireLadder = (e: LadderEntry): WireLadder => ({
  ...e,
  cashUnit: e.cashUnit.toString(),
  openPriceE8: e.openPriceE8.toString(),
  spotE8: e.spotE8.toString(),
  up: e.up.map(([t, l]) => [t, l.toString()]),
  down: e.down.map(([t, l]) => [t, l.toString()]),
});

export interface LadderBoard {
  get(key: { marketId?: string; termsCid?: string }): LadderEntry | null;
  all(): LadderEntry[];
  put(e: LadderEntry): void;
  close(marketId: string): void;
  subscribe(listener: (e: LadderEntry) => void): () => void;
}

const sameLevels = (a: readonly BookLevel[], b: readonly BookLevel[]) => a.length === b.length && a.every(([t, l], i) => b[i]![0] === t && b[i]![1] === l);

/** Whether `next` would walk differently from `prev` (spot and `asOfMs` alone do not count). */
export function ladderChanged(prev: LadderEntry | undefined, next: LadderEntry): boolean {
  return (
    !prev || prev.state !== next.state || prev.fairTicks !== next.fairTicks || prev.quotingUntilSec !== next.quotingUntilSec || prev.termsCid !== next.termsCid ||
    prev.sigmaBps !== next.sigmaBps || prev.halfSpreadTicks !== next.halfSpreadTicks || !sameLevels(prev.up, next.up) || !sameLevels(prev.down, next.down)
  );
}

export function createLadderBoard(): LadderBoard {
  const byMarket = new Map<string, LadderEntry>();
  const listeners = new Set<(e: LadderEntry) => void>();
  const emit = (e: LadderEntry) => {
    for (const l of listeners) l(e);
  };
  return {
    get: ({ marketId, termsCid }) => {
      if (marketId) return byMarket.get(marketId) ?? null;
      if (termsCid) return [...byMarket.values()].find((e) => e.termsCid === termsCid) ?? null;
      return null;
    },
    all: () => [...byMarket.values()],
    put(e) {
      const prev = byMarket.get(e.marketId);
      byMarket.set(e.marketId, e);
      if (ladderChanged(prev, e)) emit(e);
    },
    close(marketId) {
      const e = byMarket.get(marketId);
      if (!e) return;
      byMarket.delete(marketId);
      emit({ ...e, up: [], down: [], state: "closed", asOfMs: Date.now() });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
