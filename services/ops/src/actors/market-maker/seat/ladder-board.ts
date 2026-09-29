/**
 * The process's venue price ladders, one per quoting Window: the pricer writes, the quote issuer walks, and
 * `/ladders/stream` publishes. In memory only; the pricer rebuilds every entry within one pass after a restart.
 *
 * `marketId` is the app's id (`@agari/core` `marketIdFromDaml` of the terms' `damlMarketId`), the one the web keys
 * every Window on and sends back in `POST /internal/quotes`; `seriesId` is `seriesIdFromDaml(seriesKey)`.
 *
 * Wire shape (`/ladders/latest`, `event: ladder` on `/ladders/stream`), integers as decimal strings where they may
 * exceed 2^53: `{ marketId, damlMarketId, seriesId, termsCid, seriesKey, symbol, index, tradingStartSec, lockAtSec, expirySec, quotingUntilSec,
 * cashUnit, feeRateBps, fairTicks, openPriceE8, spotE8, up: [[ticks, "lots"], …], down: […], asOfMs, state }` where
 * `up`/`down` are core `BookLevel[]` best first, in the bought outcome's own terms. `state: "closed"` is sent once when a
 * Window stops quoting, and the entry is dropped.
 */
import type { BookLevel } from "@agari/core/market";

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
      byMarket.set(e.marketId, e);
      emit(e);
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
