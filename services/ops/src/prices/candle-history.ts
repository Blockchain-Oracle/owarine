/**
 * Recent 1-minute candle closes from the three oracle exchanges, for the realised-vol re-measure (C6). The same public,
 * keyless endpoints the feeders print from (`@owarine/core/proof` `candleUrl`), asked for a range instead of one bar:
 *
 *   Coinbase Exchange  /products/<S>-USD/candles?granularity=60&start&end   ≤ 300 bars a request, newest first
 *   Kraken             /0/public/OHLC?pair=<P>&interval=1&since            the newest ≤ 720 bars, oldest first
 *   Bitstamp           /api/v2/ohlc/<s>usd/?step=60&limit=1000&end         ≤ 1,000 bars a request, oldest first
 *
 * Parsers are pure over the response text; only committed bars are returned (Kraken's still-forming last row is not).
 */
import type { Close } from "@owarine/core/market";
import type { Exchange, Fetch } from "./candles";

const BAR_SEC = 60;
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const UA = { "user-agent": "owarine-vol-meter" };

export function parseCoinbaseHistory(text: string): Close[] {
  const rows = JSON.parse(text) as unknown;
  if (!Array.isArray(rows)) throw new Error(`coinbase: ${text.slice(0, 120)}`);
  return (rows as unknown[][]).filter((r) => Array.isArray(r) && typeof r[0] === "number").map((r) => ({ sec: r[0] as number, price: Number(r[4]) }));
}

export function parseKrakenHistory(text: string): Close[] {
  const body = JSON.parse(text) as { error?: string[]; result?: Record<string, unknown> };
  if (body.error?.length) throw new Error(`kraken: ${body.error.join(", ")}`);
  const result = body.result ?? {};
  const key = Object.keys(result).find((k) => k !== "last");
  const rows = (key ? result[key] : []) as unknown[][];
  const last = Number(result.last ?? 0);
  // `last` is the newest committed bar's start; anything after it is still forming.
  return rows.filter((r) => Number(r[0]) <= last).map((r) => ({ sec: Number(r[0]), price: Number(r[4]) }));
}

export function parseBitstampHistory(text: string): Close[] {
  // Bitstamp's row: `{ timestamp, open, high, low, close, volume }`, all strings (keyed as core `closeFromPayload` reads it).
  const rows = (JSON.parse(text) as { data?: { ohlc?: Record<"timestamp" | "close", string>[] } }).data?.ohlc;
  if (!Array.isArray(rows)) throw new Error(`bitstamp: ${text.slice(0, 120)}`);
  return rows.map((r) => ({ sec: Number(r.timestamp), price: Number(r.close) }));
}

/** Committed 1-minute closes in `[fromSec, toSec)`, deduplicated and sorted, from one exchange. */
export async function fetchCloseHistory(exchange: Exchange, symbol: string, fromSec: number, toSec: number, fetchImpl: Fetch = fetch as Fetch): Promise<Close[]> {
  const get = async (url: string) => {
    const r = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(10_000) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${exchange} ${symbol} HTTP ${r.status}`);
    return text;
  };
  const out: Close[] = [];
  if (exchange === "coinbase") {
    for (let start = fromSec; start < toSec; start += 300 * BAR_SEC) {
      const end = Math.min(toSec, start + 300 * BAR_SEC);
      out.push(...parseCoinbaseHistory(await get(`https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=60&start=${iso(start)}&end=${iso(end - BAR_SEC)}`)));
    }
  } else if (exchange === "kraken") {
    out.push(...parseKrakenHistory(await get(`https://api.kraken.com/0/public/OHLC?pair=${symbol === "BTC" ? "XBTUSD" : `${symbol}USD`}&interval=1&since=${fromSec - BAR_SEC}`)));
  } else {
    for (let end = toSec; end > fromSec; end -= 1_000 * BAR_SEC) {
      out.push(...parseBitstampHistory(await get(`https://www.bitstamp.net/api/v2/ohlc/${symbol.toLowerCase()}usd/?step=60&limit=1000&end=${end - BAR_SEC}`)));
    }
  }
  const bySec = new Map<number, Close>();
  for (const c of out) if (c.sec >= fromSec && c.sec < toSec && Number.isFinite(c.price) && c.price > 0 && !bySec.has(c.sec)) bySec.set(c.sec, c);
  return [...bySec.values()].sort((a, b) => a.sec - b.sec);
}
