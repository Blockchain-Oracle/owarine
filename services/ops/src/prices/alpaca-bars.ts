/**
 * Alpaca market data for the stock and ETF tickers on the trading screen (revamp step 3): chart candles from
 * `/v2/stocks/<S>/bars` and the picker's day figures from `/v2/stocks/snapshots`, on the IEX feed the spot relay already
 * reads (`spot-feed.ts`). Every chart interval is an Alpaca timeframe, so nothing is aggregated; bars come newest first
 * (`sort=desc`) and are returned oldest first. Display only.
 */
import { TICKERS, type TickerSymbol } from "@owarine/core/market";
import { decimalToE8, type Fetch } from "./candles";

export interface AlpacaKeys {
  keyId: string;
  secretKey: string;
  dataUrl?: string;
}

const DATA_URL = "https://data.alpaca.markets/v2";
const TIMEFRAME: Record<string, string> = { "1m": "1Min", "3m": "3Min", "5m": "5Min", "15m": "15Min", "30m": "30Min", "1h": "1Hour", "2h": "2Hour", "4h": "4Hour", "12h": "12Hour", "1d": "1Day" };
/** A trading day is 6.5 of 24 hours and a week 5 of 7 days: reach this many intervals back per bar wanted, plus a long weekend. */
const REACH = 7;
const WEEKEND_SEC = 4 * 86_400;

type Candle = [number, number, number, number, number];

/** The Alpaca symbol behind a ticker; null for anything Alpaca doesn't price (crypto, baskets, pre-IPO valuations). */
export function alpacaSymbolOf(symbol: string): string | null {
  return (TICKERS as Record<string, { alpacaSymbol: string | null } | undefined>)[symbol]?.alpacaSymbol ?? null;
}

const headers = (keys: AlpacaKeys) => ({ "APCA-API-KEY-ID": keys.keyId, "APCA-API-SECRET-KEY": keys.secretKey, "user-agent": "owarine-chart-candles" });
const base = (keys: AlpacaKeys) => (keys.dataUrl ?? DATA_URL).replace(/\/+$/, "");

/** `{ bars: [{ t, o, h, l, c }] }` in any order → ascending `[tMs, o, h, l, c]`. */
export function parseAlpacaBars(text: string): Candle[] {
  const body = JSON.parse(text) as { bars?: Array<{ t?: string; o?: number; h?: number; l?: number; c?: number }> | null; message?: string };
  if (body.bars === undefined) throw new Error(`alpaca bars: ${body.message ?? text.slice(0, 120)}`);
  return (body.bars ?? [])
    .filter((b) => typeof b.t === "string" && [b.o, b.h, b.l, b.c].every((v) => typeof v === "number"))
    .map((b) => [Date.parse(b.t!), b.o!, b.h!, b.l!, b.c!] as Candle)
    .sort((a, b) => a[0] - b[0]);
}

export async function alpacaCandles(fetchImpl: Fetch, keys: AlpacaKeys, symbol: string, interval: string, intervalSec: number, count: number, endMs: number): Promise<Candle[]> {
  const sym = alpacaSymbolOf(symbol);
  const timeframe = TIMEFRAME[interval];
  if (!sym || !timeframe) return [];
  const endSec = Math.floor(endMs / 1000);
  const startSec = endSec - count * intervalSec * REACH - WEEKEND_SEC;
  const iso = (sec: number) => new Date(sec * 1000).toISOString();
  const url = `${base(keys)}/stocks/${sym}/bars?timeframe=${timeframe}&start=${iso(startSec)}&end=${iso(endSec)}&limit=${count}&sort=desc&feed=iex&adjustment=raw`;
  const r = await fetchImpl(url, { headers: headers(keys), signal: AbortSignal.timeout(6_000) });
  if (!r.ok) throw new Error(`alpaca bars HTTP ${r.status}`);
  return parseAlpacaBars(await r.text());
}

export interface StockDay {
  openE8: string;
  highE8: string;
  lowE8: string;
  volume: string;
}

/**
 * Today's bar per symbol. A stock's change is quoted against the previous close, so `openE8` carries that close
 * (the picker's change is `last / open − 1`); before today's first trade it is yesterday's bar against the day before.
 */
export function parseAlpacaSnapshots(text: string, symbols: readonly TickerSymbol[]): Record<string, StockDay> {
  type Bar = { o?: number; h?: number; l?: number; c?: number; v?: number };
  const body = JSON.parse(text) as Record<string, { dailyBar?: Bar | null; prevDailyBar?: Bar | null } | null>;
  const out: Record<string, StockDay> = {};
  for (const symbol of symbols) {
    const snap = body[alpacaSymbolOf(symbol) ?? ""];
    const day = snap?.dailyBar;
    const prev = snap?.prevDailyBar;
    if (!day || typeof day.h !== "number" || typeof day.l !== "number") continue;
    const ref = typeof prev?.c === "number" ? prev.c : day.o;
    if (typeof ref !== "number") continue;
    out[symbol] = { openE8: decimalToE8(String(ref)).toString(), highE8: decimalToE8(String(day.h)).toString(), lowE8: decimalToE8(String(day.l)).toString(), volume: String(day.v ?? 0) };
  }
  return out;
}

export async function alpacaDay(fetchImpl: Fetch, keys: AlpacaKeys, symbols: readonly TickerSymbol[]): Promise<Record<string, StockDay>> {
  const syms = symbols.map(alpacaSymbolOf).filter((s): s is string => s !== null);
  if (syms.length === 0) return {};
  const r = await fetchImpl(`${base(keys)}/stocks/snapshots?symbols=${syms.join(",")}&feed=iex`, { headers: headers(keys), signal: AbortSignal.timeout(6_000) });
  if (!r.ok) throw new Error(`alpaca snapshots HTTP ${r.status}`);
  return parseAlpacaSnapshots(await r.text(), symbols);
}
