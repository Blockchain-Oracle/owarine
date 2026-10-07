/**
 * Venue reads every actor shares (C1 stub): Series and Markets. The pure status and lane-key helpers are unchanged; the
 * reads, which decoded agari-events accounts, throw the not-live error until the C3 adapter reads the venue's `Series`
 * and `MarketTerms` contracts.
 */
import { laneKey, TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@owarine/core/market";
import { laneBasisOf, type Address, type LaneBasis } from "@owarine/core/types";
import type { OpsClient } from "./client";
import { opsNotLive, type Market, type Series } from "./shapes";

export type SeriesView = { address: Address; symbol: TickerSymbol | null; data: Series };
export type MarketView = { address: Address; data: Market };

export const MARKET_STATE = { open: 0, resolved: 1, voided: 2 } as const;
export const MARKET_FLAG = { bookReleased: 1, ledgerClosed: 2, singleSource: 4 } as const;

export type MarketStatus = "listed" | "trading" | "locked" | "resolved" | "voided";

/** Status from the clock, as the reference derives it (no open/close choices on the ledger). */
export function marketStatus(m: Market, nowSec: number): MarketStatus {
  if (m.state === MARKET_STATE.resolved) return "resolved";
  if (m.state === MARKET_STATE.voided) return "voided";
  if (nowSec < Number(m.tradingStartSec)) return "listed";
  return nowSec < Number(m.lockAtSec) ? "trading" : "locked";
}

export const isTerminal = (m: Market) => m.state !== MARKET_STATE.open;

export const seriesBasis = (s: SeriesView): LaneBasis | null => laneBasisOf(s.data.basis);

/** `TSLA-5m`, `TSLA-gap`, `BTC-5m` (core `laneKey`); `#<ticker>-<basis>-<cadence>` outside the registry. */
export function seriesLaneKey(s: SeriesView): string {
  const basis = seriesBasis(s);
  return s.symbol && basis ? laneKey(s.symbol, basis, s.data.cadenceSec) : `#${s.data.ticker}-${s.data.basis}-${s.data.cadenceSec}`;
}

/** The registry ticker of a Series id, or null outside the registry. */
export const symbolOfSeriesId = (ticker: number): TickerSymbol | null => SYMBOL_BY_SERIES_ID.get(ticker) ?? null;
const SYMBOL_BY_SERIES_ID = new Map<number, TickerSymbol>(TICKER_SYMBOLS.map((s) => [TICKERS[s].seriesId, s]));

export async function listSeries(_client: OpsClient): Promise<SeriesView[]> {
  throw opsNotLive();
}

export async function listMarketsOfSeries(_client: OpsClient, _series: Address): Promise<MarketView[]> {
  throw opsNotLive();
}

export async function fetchMarkets(_client: OpsClient, _addresses: readonly Address[]): Promise<Array<MarketView | null>> {
  throw opsNotLive();
}

export async function fetchSeries(_client: OpsClient, _addresses: readonly Address[]): Promise<Array<SeriesView | null>> {
  throw opsNotLive();
}
