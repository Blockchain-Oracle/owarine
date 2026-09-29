/**
 * The crypto lanes' spot (C3): the last trade of each crypto symbol on Coinbase Exchange, polled every 2 s, as a
 * `SpotFeed`. The pricer's fair value reads it (spot against the Window's recorded open print) and `/prices/stream`
 * serves it. It never settles anything: Windows settle on the oracle parties' attested candle closes.
 */
import { CRYPTO_SYMBOLS, type CryptoSymbol } from "@agari/core/market";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import { decimalToE8, type Fetch } from "./candles";
import type { SpotFeed, SpotQuote } from "./spot";

export interface CryptoSpotHandle extends SpotFeed {
  start(): void;
  stop(): void;
}

const EVERY_MS = 2_000;
const DEFAULT_MAX_AGE_SEC = 30;

export function createCryptoSpotFeed(input: { log: (why: string) => void; symbols?: readonly CryptoSymbol[]; fetchImpl?: Fetch; everyMs?: number }): CryptoSpotHandle {
  const symbols = input.symbols ?? CRYPTO_SYMBOLS;
  const fetchImpl = input.fetchImpl ?? (fetch as Fetch);
  const quotes = new Map<string, SpotQuote>();
  const listeners = new Set<(q: SpotQuote) => void>();
  const beat = registerHeartbeat("crypto-spot", false, input.everyMs ?? EVERY_MS);
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastError = "";

  const poll = async (symbol: CryptoSymbol) => {
    const r = await fetchImpl(`https://api.exchange.coinbase.com/products/${symbol}-USD/ticker`, { headers: { "user-agent": "agari-crypto-spot" }, signal: AbortSignal.timeout(4_000) });
    if (!r.ok) throw new Error(`coinbase ticker ${symbol} HTTP ${r.status}`);
    const body = JSON.parse(await r.text()) as { price?: string; time?: string };
    if (typeof body.price !== "string") throw new Error(`coinbase ticker ${symbol}: no price`);
    const publishTimeSec = Math.floor((body.time ? Date.parse(body.time) : Date.now()) / 1000);
    const quote: SpotQuote = { symbol, priceE8: decimalToE8(body.price), publishTimeSec, source: "exchange" };
    const prev = quotes.get(symbol);
    quotes.set(symbol, quote);
    if (!prev || prev.priceE8 !== quote.priceE8 || prev.publishTimeSec !== quote.publishTimeSec) for (const l of listeners) l(quote);
  };

  const tick = async () => {
    const results = await Promise.allSettled(symbols.map(poll));
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    beat.lastPassMs = Date.now();
    if (failed.length === 0) {
      beat.lastOkMs = Date.now();
      beat.failures = 0;
    } else {
      beat.failures += 1;
      const why = errorText(failed[0]!.reason);
      if (why !== lastError) input.log(`crypto spot: ${why}`);
      lastError = why;
    }
    beat.lastWhy = [...quotes.values()].map((q) => `${q.symbol} ${q.priceE8}`).join(", ") || "no quote yet";
  };

  return {
    start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), input.everyMs ?? EVERY_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    latest(symbol, maxAgeSec = DEFAULT_MAX_AGE_SEC) {
      const q = quotes.get(symbol);
      return q && Math.floor(Date.now() / 1000) - q.publishTimeSec <= maxAgeSec ? q : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The crypto feed first for its symbols, else `base` (the process's equity feed); null base serves crypto alone. */
export function joinCryptoSpot(base: SpotFeed | null, crypto: SpotFeed): SpotFeed {
  const isCrypto = (s: string) => (CRYPTO_SYMBOLS as readonly string[]).includes(s);
  return {
    latest: (symbol, maxAgeSec) => (isCrypto(symbol) ? crypto.latest(symbol, maxAgeSec) : (base?.latest(symbol, maxAgeSec) ?? null)),
    subscribe(listener) {
      const offs = [crypto.subscribe(listener), ...(base ? [base.subscribe(listener)] : [])];
      return () => offs.forEach((off) => off());
    },
  };
}
