/**
 * 24-hour stats per crypto symbol for the market picker (revamp step 3, Tradash's "Last price / 24h change" and Hot):
 * Coinbase Exchange `/products/<S>-USD/stats` (open, high, low, volume over the last 24 h), read at most once a minute.
 * Stocks and ETFs come from Alpaca's snapshots when ops holds Alpaca keys, their change quoted against the previous
 * close (`alpaca-bars.ts`). Display only. `/prices/day` serves `{ [symbol]: { openE8, highE8, lowE8, volume } }`; a symbol whose read failed is
 * absent rather than guessed.
 */
import { CRYPTO_SYMBOLS, TICKER_SYMBOLS } from "@owarine/core/market";
import { alpacaDay, alpacaSymbolOf, type AlpacaKeys } from "./alpaca-bars";
import { decimalToE8, type Fetch } from "./candles";

export interface DayStats {
  openE8: string;
  highE8: string;
  lowE8: string;
  volume: string;
}

const CACHE_MS = 60_000;

const STOCKS = TICKER_SYMBOLS.filter((s) => alpacaSymbolOf(s) !== null);

export function createDayStats(fetchImpl: Fetch = fetch as Fetch, alpaca: AlpacaKeys | null = null): () => Promise<Record<string, DayStats>> {
  let cached: { atMs: number; body: Promise<Record<string, DayStats>> } | null = null;
  const read = async (): Promise<Record<string, DayStats>> => {
    const out: Record<string, DayStats> = {};
    await Promise.all([
      ...CRYPTO_SYMBOLS.map(async (symbol) => {
        try {
          const r = await fetchImpl(`https://api.exchange.coinbase.com/products/${symbol}-USD/stats`, { headers: { "user-agent": "owarine-day-stats" }, signal: AbortSignal.timeout(5_000) });
          if (!r.ok) return;
          const b = JSON.parse(await r.text()) as { open?: string; high?: string; low?: string; volume?: string };
          if (typeof b.open !== "string" || typeof b.high !== "string" || typeof b.low !== "string") return;
          out[symbol] = { openE8: decimalToE8(b.open).toString(), highE8: decimalToE8(b.high).toString(), lowE8: decimalToE8(b.low).toString(), volume: b.volume ?? "0" };
        } catch {
          // Absent, not guessed.
        }
      }),
      alpaca
        ? alpacaDay(fetchImpl, alpaca, STOCKS).then(
            (stocks) => void Object.assign(out, stocks),
            () => undefined,
          )
        : Promise.resolve(),
    ]);
    return out;
  };
  return () => {
    if (!cached || Date.now() - cached.atMs > CACHE_MS) cached = { atMs: Date.now(), body: read() };
    return cached.body;
  };
}
