/**
 * The process's spot feed (venue-ops.md §6.5), implementing `SpotFeed`: the Hermes SSE stream for the Pyth trial
 * feeds and the RedStone `latest` packages every 5 s (median of the configured signers). Quotes are integers × 10⁸.
 * Pyth wins when both are fresh. A refused Pyth key stops the stream; RedStone carries on.
 *
 * C6e (K-070): the tickers RedStone does not carry (QQQ, VOO, whose only reference source was the Pyth trial) poll
 * Alpaca's latest IEX trade every 5 s with the ops keys, the same source their Windows now settle on. Pyth still wins.
 */
import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { HERMES, parsePythEntries } from "../actors/price-relay/hermes-fetch";
import { fetchRedstoneLatest, latestMedian } from "../actors/price-relay/redstone-fetch";
import type { RelaySources } from "../actors/price-relay/sources";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import type { SpotFeed, SpotQuote } from "./spot";

export interface SpotFeedHandle extends SpotFeed {
  start(): void;
  stop(): void;
  /** Symbols with any quote, freshest first per symbol. */
  symbols(): TickerSymbol[];
}

const REDSTONE_EVERY_MS = 5_000;
const DEFAULT_MAX_AGE_SEC = 30;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ALPACA_DATA_URL = "https://data.alpaca.markets/v2";
const ALPACA_MAX_AGE_SEC = 120;

/** Alpaca `/stocks/trades/latest` → one quote per symbol with a priced trade. Pure. */
export function alpacaLatestQuotes(text: string, symbols: readonly TickerSymbol[]): SpotQuote[] {
  const body = JSON.parse(text) as { trades?: Record<string, { p?: unknown; t?: unknown }> };
  return symbols.flatMap((symbol) => {
    const trade = body.trades?.[symbol];
    if (!trade || typeof trade.p !== "number" || !(trade.p > 0) || typeof trade.t !== "string") return [];
    const [whole, frac = ""] = trade.p.toFixed(8).split(".");
    return [{ symbol, priceE8: BigInt(whole!) * 100_000_000n + BigInt(frac.padEnd(8, "0").slice(0, 8)), publishTimeSec: Math.floor(Date.parse(trade.t) / 1000), source: "alpaca" as const }];
  });
}

export function createSpotFeed(input: {
  sources: RelaySources;
  pythKey?: string;
  /** C6e: Alpaca market-data keys; the tickers without a RedStone feed poll it. */
  alpaca?: { keyId: string; secretKey: string; dataUrl?: string } | null;
  log: (why: string) => void;
}): SpotFeedHandle {
  const { sources, pythKey, log } = input;
  const alpacaSymbols = TICKER_SYMBOLS.filter((s) => !sources.redstoneFeeds.some((f) => f.symbol === s));
  const quotes = new Map<string, SpotQuote>();
  const listeners = new Set<(q: SpotQuote) => void>();
  const beat = registerHeartbeat("spot-feed", false);
  const bySymbolFeed = new Map(sources.pythFeeds.map((f) => [f.feedIdHex, f.symbol]));
  let stopped = false;
  let controller: AbortController | null = null;

  const emit = (quote: SpotQuote) => {
    const key = `${quote.symbol}:${quote.source}`;
    const prev = quotes.get(key);
    if (prev && prev.publishTimeSec >= quote.publishTimeSec) return;
    quotes.set(key, quote);
    beat.lastOkMs = Date.now();
    beat.lastPassMs = Date.now();
    beat.failures = 0;
    beat.detail = Object.fromEntries([...quotes.entries()].map(([k, q]) => [k, { priceE8: q.priceE8.toString(), publishTimeSec: q.publishTimeSec }]));
    for (const listener of listeners) listener(quote);
  };

  async function streamPyth(): Promise<void> {
    if (!pythKey || sources.pythFeeds.length === 0) return;
    const ids = sources.pythFeeds.map((f) => `ids[]=${f.feedIdHex}`).join("&");
    let backoffMs = 2_000;
    while (!stopped) {
      controller = new AbortController();
      try {
        const res = await fetch(`${HERMES}/v2/updates/price/stream?${ids}&parsed=true&encoding=base64`, { headers: { Authorization: `Bearer ${pythKey}` }, signal: controller.signal });
        if (res.status === 401 || res.status === 403) {
          log(`Hermes refused the Pyth key (HTTP ${res.status}): the trial is over; spot continues on RedStone only`);
          return;
        }
        if (!res.ok || !res.body) throw new Error(`Hermes stream HTTP ${res.status}`);
        log("Pyth stream connected");
        backoffMs = 2_000;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const body = JSON.parse(line.slice(5)) as { parsed?: Parameters<typeof parsePythEntries>[0] };
            for (const p of parsePythEntries(body.parsed ?? [])) {
              const symbol = bySymbolFeed.get(p.feedIdHex);
              if (symbol) emit({ symbol, priceE8: p.priceE8, publishTimeSec: p.publishTimeSec, source: "pyth" });
            }
          }
        }
        log("Pyth stream ended; reconnecting");
      } catch (error) {
        if (stopped) return;
        beat.failures += 1;
        log(`Pyth stream error: ${errorText(error)}; retrying in ${backoffMs / 1000} s`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
      }
    }
  }

  async function pollRedstone(): Promise<void> {
    while (!stopped) {
      const started = Date.now();
      try {
        const { text } = await fetchRedstoneLatest(sources.gateways);
        for (const { symbol, feed } of sources.redstoneFeeds) {
          const median = latestMedian(text, feed, sources.redstoneSigners);
          if (median) emit({ symbol, priceE8: median.priceE8, publishTimeSec: median.publishTimeSec, source: "redstone" });
        }
      } catch (error) {
        beat.failures += 1;
        beat.lastWhy = `RedStone latest failed: ${errorText(error)}`;
      }
      await sleep(Math.max(0, REDSTONE_EVERY_MS - (Date.now() - started)));
    }
  }

  async function pollAlpaca(): Promise<void> {
    const keys = input.alpaca;
    if (!keys || alpacaSymbols.length === 0) return;
    const base = (keys.dataUrl ?? ALPACA_DATA_URL).replace(/\/+$/, "");
    let failedLogged = false;
    while (!stopped) {
      const started = Date.now();
      try {
        const res = await fetch(`${base}/stocks/trades/latest?symbols=${alpacaSymbols.join(",")}&feed=iex`, {
          headers: { "APCA-API-KEY-ID": keys.keyId, "APCA-API-SECRET-KEY": keys.secretKey }, signal: AbortSignal.timeout(8_000),
        });
        if (res.status === 401 || res.status === 403) {
          log(`Alpaca refused the key (HTTP ${res.status}): ${alpacaSymbols.join(",")} spot stops`);
          return;
        }
        if (!res.ok) throw new Error(`Alpaca latest trades HTTP ${res.status}`);
        for (const q of alpacaLatestQuotes(await res.text(), alpacaSymbols)) emit(q);
        failedLogged = false;
      } catch (error) {
        beat.failures += 1;
        beat.lastWhy = `Alpaca latest failed: ${errorText(error)}`;
        if (!failedLogged) log(beat.lastWhy);
        failedLogged = true;
      }
      await sleep(Math.max(0, REDSTONE_EVERY_MS - (Date.now() - started)));
    }
  }

  return {
    latest(symbol, maxAgeSec = DEFAULT_MAX_AGE_SEC) {
      const now = Math.floor(Date.now() / 1000);
      const fresh = (q: SpotQuote | undefined, ageSec = maxAgeSec) => (q && now - q.publishTimeSec <= ageSec ? q : null);
      // An IEX trade on a quiet ETF can be a minute old in session; it is still the last price (C6e).
      return fresh(quotes.get(`${symbol}:pyth`)) ?? fresh(quotes.get(`${symbol}:redstone`)) ?? fresh(quotes.get(`${symbol}:alpaca`), Math.max(maxAgeSec, ALPACA_MAX_AGE_SEC));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    symbols: () => TICKER_SYMBOLS.filter((s) => quotes.has(`${s}:pyth`) || quotes.has(`${s}:redstone`) || quotes.has(`${s}:alpaca`)),
    start() {
      beat.lastWhy = "streaming";
      void streamPyth();
      void pollRedstone();
      void pollAlpaca();
    },
    stop() {
      stopped = true;
      controller?.abort();
    },
  };
}
