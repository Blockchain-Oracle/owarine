/**
 * One-minute exchange candles, the pure half (plan "Venue operations": a print is the close of the exchange's 1-minute
 * candle ending at T, so anyone can re-fetch it afterwards). The oracle feeders (`services/ops/src/prices/candles.ts`)
 * fetch with these URLs and read with these rules; the proof page's re-verify reads the archived bytes and a fresh
 * fetch with the same ones, so the two can never disagree about what a payload says. Endpoints and the "is this candle
 * final" rules are the ones the candle-lag probe measured (`scripts/probes/candle-lag.mjs`, K-025): Coinbase Exchange,
 * Kraken and Bitstamp, each public and keyless.
 */
export type Exchange = "coinbase" | "kraken" | "bitstamp";
export const EXCHANGES: readonly Exchange[] = ["coinbase", "kraken", "bitstamp"];

export const isExchange = (value: string): value is Exchange => (EXCHANGES as readonly string[]).includes(value);

export const CANDLE_BAR_SEC = 60;

/** A decimal string → price × 10⁸, exact; digits past the 8th decimal are dropped (no exchange quotes BTC/ETH that fine). */
export function decimalToE8(text: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) throw new Error(`not a positive decimal: ${JSON.stringify(text)}`);
  return BigInt(m[1]! + (m[2] ?? "").slice(0, 8).padEnd(8, "0"));
}

/** A JSON number the exchange sent (Coinbase) back to its shortest decimal text. */
const numberText = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(v).includes("e") ? v.toFixed(8) : String(v);
  throw new Error(`not a price: ${JSON.stringify(v)}`);
};

const iso = (sec: number) => new Date(sec * 1000).toISOString();

export function candleUrl(exchange: Exchange, symbol: string, boundarySec: number): string {
  const startSec = boundarySec - CANDLE_BAR_SEC;
  switch (exchange) {
    case "coinbase":
      return `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=60&start=${iso(startSec)}&end=${iso(boundarySec)}`;
    case "kraken":
      return `https://api.kraken.com/0/public/OHLC?pair=${symbol === "BTC" ? "XBTUSD" : `${symbol}USD`}&interval=1&since=${startSec - 120}`;
    case "bitstamp":
      return `https://www.bitstamp.net/api/v2/ohlc/${symbol.toLowerCase()}usd/?step=60&limit=3&end=${boundarySec}`;
  }
}

/** The close of the candle starting at `boundarySec − 60` in a response body, or null when it is not (yet, or any longer) there. */
export function closeFromPayload(exchange: Exchange, payload: string, boundarySec: number): string | null {
  const startSec = boundarySec - CANDLE_BAR_SEC;
  const body = JSON.parse(payload) as unknown;
  switch (exchange) {
    case "coinbase": {
      // [[time, low, high, open, close, volume], …], newest first.
      const row = Array.isArray(body) ? (body as unknown[][]).find((c) => Array.isArray(c) && c[0] === startSec) : undefined;
      return row ? numberText(row[4]) : null;
    }
    case "kraken": {
      const result = (body as { result?: Record<string, unknown> }).result ?? {};
      const key = Object.keys(result).find((k) => k !== "last");
      const rows = (key ? result[key] : []) as unknown[][];
      // `last` is the start of the newest committed candle; the row after it is still forming.
      const last = Number(result.last ?? 0);
      const row = Array.isArray(rows) ? rows.find((c) => c[0] === startSec) : undefined;
      return row && last >= startSec ? numberText(row[4]) : null;
    }
    case "bitstamp": {
      // Bitstamp's row: `{ timestamp, open, high, low, close, volume }`, all strings.
      const rows = (body as { data?: { ohlc?: Record<"timestamp" | "close", string>[] } }).data?.ohlc ?? [];
      const row = rows.find((c) => Number(c.timestamp) === startSec);
      return row ? numberText(row.close) : null;
    }
  }
}

/** The close in a payload as × 10⁸, or null when the payload holds no final candle for T (or is not JSON). */
export function closeE8FromPayload(exchange: Exchange, payload: string, boundarySec: number): bigint | null {
  try {
    const text = closeFromPayload(exchange, payload, boundarySec);
    return text === null ? null : decimalToE8(text);
  } catch {
    return null;
  }
}
