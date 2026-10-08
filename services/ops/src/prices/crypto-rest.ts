/**
 * The crypto spot's REST fallback across five venues (8 Oct 2026 audit). The Coinbase socket is the fast path; when it
 * goes quiet, one exchange's REST was the only stand-in, and a network path that drops Coinbase (an iPhone hotspot
 * blackholed whole Cloudflare ranges for hours on 7–8 Oct) froze BTC and ETH and stopped quoting. Now every quiet tick
 * asks Coinbase, Bitstamp, Bitfinex, Kraken and Gemini at once, each with a short timeout, and publishes the MEDIAN of
 * the last trades that came back within `MAX_TRADE_AGE_MS`. One venue down, slow or off (a stale or bad print) moves
 * nothing; any one answering keeps the spot alive.
 *
 * Display and quoting only: Windows settle on the oracle parties' attested candle closes, never on this.
 */
import type { CryptoSymbol } from "@owarine/core/market";
import { decimalToE8, type Fetch } from "./candles";

export type CryptoVenue = "coinbase" | "bitstamp" | "bitfinex" | "kraken" | "gemini";

export interface VenueTrade {
  venue: CryptoVenue;
  priceE8: bigint;
  timeMs: number;
}

/** A venue's last trade older than this is not spot any more. */
export const MAX_TRADE_AGE_MS = 60_000;
const TIMEOUT_MS = 3_000;
const UA = { "user-agent": "owarine-crypto-spot" };

/** Each venue's pair names (Kraken answers BTC as XXBTZUSD). */
const PAIRS: Record<CryptoVenue, Partial<Record<CryptoSymbol, string>>> = {
  coinbase: { BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD" },
  bitstamp: { BTC: "btcusd", ETH: "ethusd", SOL: "solusd" },
  bitfinex: { BTC: "tBTCUSD", ETH: "tETHUSD", SOL: "tSOLUSD" },
  kraken: { BTC: "XBTUSD", ETH: "ETHUSD", SOL: "SOLUSD" },
  gemini: { BTC: "btcusd", ETH: "ethusd", SOL: "solusd" },
};
const KRAKEN_KEYS: Partial<Record<CryptoSymbol, readonly string[]>> = { BTC: ["XXBTZUSD", "XBTUSD"], ETH: ["XETHZUSD", "ETHUSD"], SOL: ["SOLUSD"] };

const DECIMAL = /^\d+(\.\d+)?$/;
const toDecimal = (v: unknown): string | null => {
  const s = typeof v === "number" ? (Number.isFinite(v) && v > 0 ? String(v) : null) : typeof v === "string" ? v : null;
  return s && DECIMAL.test(s) ? s : null;
};

async function getJson(fetchImpl: Fetch, url: string): Promise<unknown> {
  const r = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`${new URL(url).host} HTTP ${r.status}`);
  return JSON.parse(await r.text()) as unknown;
}

/** One venue's last trades for the symbols it lists; a venue answering one call for every symbol is asked once. */
export async function readVenue(venue: CryptoVenue, symbols: readonly CryptoSymbol[], fetchImpl: Fetch, nowMs: number): Promise<Map<CryptoSymbol, VenueTrade>> {
  const out = new Map<CryptoSymbol, VenueTrade>();
  const put = (symbol: CryptoSymbol, price: unknown, timeMs: number) => {
    const d = toDecimal(price);
    if (d) out.set(symbol, { venue, priceE8: decimalToE8(d), timeMs: Number.isFinite(timeMs) ? timeMs : nowMs });
  };
  const listed = symbols.filter((s) => PAIRS[venue][s]);
  if (listed.length === 0) return out;
  switch (venue) {
    case "coinbase":
      await Promise.all(listed.map(async (s) => {
        const b = (await getJson(fetchImpl, `https://api.exchange.coinbase.com/products/${PAIRS.coinbase[s]}/ticker`)) as { price?: unknown; time?: string };
        put(s, b.price, b.time ? Date.parse(b.time) : nowMs);
      }));
      break;
    case "bitstamp":
      await Promise.all(listed.map(async (s) => {
        // Bitstamp's own field names: `last`, and the trade time in whole seconds.
        const b = (await getJson(fetchImpl, `https://www.bitstamp.net/api/v2/ticker/${PAIRS.bitstamp[s]}/`)) as Record<string, unknown>;
        const tradeSec = Number(b["timestamp"]);
        put(s, b.last, Number.isFinite(tradeSec) && tradeSec > 0 ? tradeSec * 1000 : nowMs);
      }));
      break;
    case "bitfinex": {
      const rows = (await getJson(fetchImpl, `https://api-pub.bitfinex.com/v2/tickers?symbols=${listed.map((s) => PAIRS.bitfinex[s]).join(",")}`)) as unknown[][];
      // [SYMBOL, BID, BID_SIZE, ASK, ASK_SIZE, DAILY_CHANGE, DAILY_CHANGE_RELATIVE, LAST_PRICE, …]; no trade time, so now.
      for (const s of listed) {
        const row = Array.isArray(rows) ? rows.find((r) => Array.isArray(r) && r[0] === PAIRS.bitfinex[s]) : undefined;
        if (row) put(s, row[7], nowMs);
      }
      break;
    }
    case "kraken": {
      const b = (await getJson(fetchImpl, `https://api.kraken.com/0/public/Ticker?pair=${listed.map((s) => PAIRS.kraken[s]).join(",")}`)) as { error?: unknown[]; result?: Record<string, { c?: unknown[] }> };
      for (const s of listed) {
        const key = (KRAKEN_KEYS[s] ?? []).find((k) => b.result?.[k]);
        if (key) put(s, b.result![key]!.c?.[0], nowMs);
      }
      break;
    }
    case "gemini":
      await Promise.all(listed.map(async (s) => {
        // Gemini's own field names: `last`, and the trade time in milliseconds under `volume`.
        const b = (await getJson(fetchImpl, `https://api.gemini.com/v1/pubticker/${PAIRS.gemini[s]}`)) as Record<string, unknown>;
        const tradeMs = Number((b.volume as Record<string, unknown> | undefined)?.["timestamp"]);
        put(s, b.last, Number.isFinite(tradeMs) && tradeMs > 0 ? tradeMs : nowMs);
      }));
      break;
  }
  return out;
}

export const CRYPTO_VENUES: readonly CryptoVenue[] = ["coinbase", "bitstamp", "bitfinex", "kraken", "gemini"];

/** The median of fresh trades (the lower middle of an even count, so it is always a real venue's price). */
export function medianTrade(trades: readonly VenueTrade[], nowMs: number): VenueTrade | null {
  const fresh = trades.filter((t) => nowMs - t.timeMs <= MAX_TRADE_AGE_MS).sort((a, b) => (a.priceE8 < b.priceE8 ? -1 : a.priceE8 > b.priceE8 ? 1 : 0));
  if (fresh.length === 0) return null;
  return fresh[Math.floor((fresh.length - 1) / 2)]!;
}

/**
 * Every venue at once for `symbols`; per symbol the median trade and how many venues answered. Which venues failed is
 * returned too, for the heartbeat. Never throws: a venue's failure is one fewer price.
 */
export async function readCryptoMedian(symbols: readonly CryptoSymbol[], fetchImpl: Fetch, nowMs: number, venues: readonly CryptoVenue[] = CRYPTO_VENUES): Promise<{ bySymbol: Map<CryptoSymbol, { trade: VenueTrade; venues: number }>; failed: CryptoVenue[] }> {
  const results = await Promise.allSettled(venues.map((v) => readVenue(v, symbols, fetchImpl, nowMs)));
  const failed: CryptoVenue[] = [];
  const perSymbol = new Map<CryptoSymbol, VenueTrade[]>();
  results.forEach((r, i) => {
    if (r.status === "rejected") return void failed.push(venues[i]!);
    for (const [s, t] of r.value) {
      perSymbol.set(s, [...(perSymbol.get(s) ?? []), t]);
    }
  });
  const bySymbol = new Map<CryptoSymbol, { trade: VenueTrade; venues: number }>();
  for (const [s, ts] of perSymbol) {
    const m = medianTrade(ts, nowMs);
    if (m) bySymbol.set(s, { trade: m, venues: ts.filter((t) => nowMs - t.timeMs <= MAX_TRADE_AGE_MS).length });
  }
  return { bySymbol, failed };
}
