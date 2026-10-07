/**
 * One-minute exchange candles for the oracle feeders (plan "Venue operations": a print is the close of the exchange's
 * 1-minute candle ending at T, so anyone can re-fetch it afterwards). Endpoints and the "is this candle final" rules
 * are the ones the candle-lag probe measured (`scripts/probes/candle-lag.mjs`, K-025): Coinbase Exchange, Kraken and
 * Bitstamp, each public and keyless.
 *
 * What is archived and hashed is the exact response text, byte for byte; the price is read from it once.
 */
import { candleUrl, closeFromPayload, decimalToE8, type Exchange } from "@owarine/core/proof";

/** The URLs and payload rules are pure and shared with the proof page's re-verify (`@owarine/core/proof`). */
export { candleUrl, closeFromPayload, decimalToE8, EXCHANGES, type Exchange } from "@owarine/core/proof";

export interface Candle {
  exchange: Exchange;
  symbol: string;
  /** The boundary T: the candle covers [T − 60, T). */
  boundarySec: number;
  /** The close as the exchange wrote it. */
  closeText: string;
  priceE8: bigint;
  url: string;
  /** The whole response body, exactly as received. */
  payload: string;
  fetchedAtMs: number;
}

export type Fetch = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const UA = { "user-agent": "owarine-oracle-feeder" };

/** Fetches the closed candle ending at `boundarySec`, or null when the exchange has not finalised it. Throws on HTTP failure. */
export async function fetchCandle(exchange: Exchange, symbol: string, boundarySec: number, fetchImpl: Fetch = fetch as Fetch): Promise<Candle | null> {
  const url = candleUrl(exchange, symbol, boundarySec);
  const r = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(5_000) });
  const payload = await r.text();
  if (!r.ok) throw new Error(`${exchange} ${symbol} HTTP ${r.status}`);
  const closeText = closeFromPayload(exchange, payload, boundarySec);
  if (closeText === null) return null;
  return { exchange, symbol, boundarySec, closeText, priceE8: decimalToE8(closeText), url, payload, fetchedAtMs: Date.now() };
}
