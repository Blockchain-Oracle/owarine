/**
 * Chart candles for the trading screen's candle view (revamp step 3; Tradash's `fetchCandles`: 1m…1d, 300 a read):
 * Coinbase Exchange `/products/<S>-USD/candles` for BTC and ETH, Bybit's CC/USDT klines in USD for Canton Coin (`bybit.ts`). Coinbase serves 1m/5m/15m/1h/6h/1d; 3m, 30m, 2h,
 * 4h and 12h are aggregated from the next finer one. Stocks and ETFs read Alpaca's bars (`alpaca-bars.ts`) when ops holds
 * Alpaca keys. Display only, cached 10 s per (symbol, interval, end). Anything else answers `unavailable` so the screen
 * says so rather than drawing nothing.
 *
 * Wire: `{ symbol, interval, candles: [[tMs, open, high, low, close], …] }`, oldest first, prices as numbers.
 */
import { CRYPTO_SYMBOLS } from "@owarine/core/market";
import { alpacaCandles, alpacaSymbolOf, type AlpacaKeys } from "./alpaca-bars";
import { bybitCandles, createUsdtRate, isBybitSymbol, type UsdtRate } from "./bybit";
import type { Fetch } from "./candles";

export const CANDLE_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "12h", "1d"] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];
export const INTERVAL_SEC: Record<CandleInterval, number> = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "2h": 7200, "4h": 14_400, "12h": 43_200, "1d": 86_400 };
/** What each interval is read at on Coinbase (its granularities) before aggregation. */
const SOURCE_SEC: Record<CandleInterval, number> = { "1m": 60, "3m": 60, "5m": 300, "15m": 900, "30m": 300, "1h": 3600, "2h": 3600, "4h": 3600, "12h": 21_600, "1d": 86_400 };
const PER_READ = 300;
const MAX_COUNT = 300;
const CACHE_MS = 10_000;

export type Candle = [number, number, number, number, number];

/** Coinbase rows `[time, low, high, open, close, volume]` (newest first) → ascending `[tMs, o, h, l, c]`. */
export function parseCoinbaseCandles(text: string): Candle[] {
  const rows = JSON.parse(text) as unknown;
  if (!Array.isArray(rows)) throw new Error(`coinbase candles: ${text.slice(0, 120)}`);
  return (rows as unknown[][])
    .filter((r) => Array.isArray(r) && r.length >= 5 && r.slice(0, 5).every((v) => typeof v === "number"))
    .map((r) => [(r[0] as number) * 1000, r[3] as number, r[2] as number, r[1] as number, r[4] as number] as Candle)
    .sort((a, b) => a[0] - b[0]);
}

/** Folds ascending finer candles into buckets of `sec` aligned to the epoch; partial buckets kept. */
export function aggregate(rows: readonly Candle[], sec: number): Candle[] {
  const out: Candle[] = [];
  const ms = sec * 1000;
  for (const [t, o, h, l, c] of rows) {
    const b = Math.floor(t / ms) * ms;
    const last = out.at(-1);
    if (last && last[0] === b) {
      last[2] = Math.max(last[2], h);
      last[3] = Math.min(last[3], l);
      last[4] = c;
    } else out.push([b, o, h, l, c]);
  }
  return out;
}

export function createChartCandles(fetchImpl: Fetch = fetch as Fetch, alpaca: AlpacaKeys | null = null, rate: UsdtRate = createUsdtRate(fetchImpl)) {
  const cache = new Map<string, { atMs: number; body: Promise<Candle[]> }>();

  const read = async (symbol: string, interval: CandleInterval, count: number, endMs: number): Promise<Candle[]> => {
    const src = SOURCE_SEC[interval];
    const want = Math.ceil((count * INTERVAL_SEC[interval]) / src);
    const rows: Candle[] = [];
    let end = Math.floor(endMs / 1000);
    while (rows.length < want) {
      const n = Math.min(PER_READ, want - rows.length);
      const start = end - n * src;
      const url = `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=${src}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;
      const r = await fetchImpl(url, { headers: { "user-agent": "owarine-chart-candles" }, signal: AbortSignal.timeout(6_000) });
      if (!r.ok) throw new Error(`coinbase candles HTTP ${r.status}`);
      const page = parseCoinbaseCandles(await r.text());
      if (page.length === 0) break;
      rows.unshift(...page.filter((c) => !rows.length || c[0] < rows[0]![0]));
      end = start;
    }
    const out = src === INTERVAL_SEC[interval] ? rows : aggregate(rows, INTERVAL_SEC[interval]);
    return out.slice(-count);
  };

  return async (input: { symbol: string; interval: string; count?: number; endMs?: number }): Promise<{ status: number; body: unknown }> => {
    const interval = input.interval as CandleInterval;
    if (!(CANDLE_INTERVALS as readonly string[]).includes(interval)) return { status: 400, body: { error: `interval must be one of ${CANDLE_INTERVALS.join(", ")}` } };
    const crypto = (CRYPTO_SYMBOLS as readonly string[]).includes(input.symbol);
    const bybit = isBybitSymbol(input.symbol);
    const stock = !crypto && !bybit && alpaca !== null && alpacaSymbolOf(input.symbol) !== null;
    if (!crypto && !bybit && !stock) return { status: 404, body: { error: "unavailable", reason: `Candles for ${input.symbol} are not available yet` } };
    const count = Math.max(1, Math.min(MAX_COUNT, Math.floor(input.count ?? MAX_COUNT)));
    const endMs = input.endMs && Number.isFinite(input.endMs) ? input.endMs : Date.now();
    const key = `${input.symbol}:${interval}:${count}:${Math.floor(endMs / CACHE_MS)}`;
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.atMs > CACHE_MS) {
      hit = {
        atMs: Date.now(),
        body: stock
          ? alpacaCandles(fetchImpl, alpaca!, input.symbol, interval, INTERVAL_SEC[interval], count, endMs)
          : bybit
            ? bybitCandles(fetchImpl, rate, input.symbol, INTERVAL_SEC[interval], count, endMs).then((rows) => rows.slice(-count))
            : read(input.symbol, interval, count, endMs),
      };
      cache.set(key, hit);
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
    }
    try {
      return { status: 200, body: { symbol: input.symbol, interval, candles: await hit.body } };
    } catch (error) {
      cache.delete(key);
      return { status: 503, body: { error: error instanceof Error ? error.message : String(error) } };
    }
  };
}
