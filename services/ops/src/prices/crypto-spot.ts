/**
 * The crypto lanes' spot (C3; revamp step 2): the last trade of each crypto symbol on Coinbase Exchange as a `SpotFeed`.
 * The public WebSocket `ticker` channel carries every trade; the REST ticker, polled every 2 s, stands in only for a
 * symbol the socket has said nothing about for `WS_QUIET_MS` (not connected yet, dropped, reconnecting). The pricer's
 * fair value reads it (spot against the Window's recorded open print) and `/prices/stream` serves it. It never settles
 * anything: Windows settle on the oracle parties' attested candle closes.
 */
import { CRYPTO_SYMBOLS, type CryptoSymbol } from "@owarine/core/market";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import { decimalToE8, type Fetch } from "./candles";
import type { SpotFeed, SpotQuote } from "./spot";

export interface CryptoSpotHandle extends SpotFeed {
  start(): void;
  stop(): void;
}

/** The slice of a WebSocket the feed uses (Node's global `WebSocket`, or a fake in tests). */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}
export type SocketFactory = (url: string) => SocketLike;

const EVERY_MS = 2_000;
const DEFAULT_MAX_AGE_SEC = 30;
export const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
/** A symbol whose last socket trade is older than this is polled over REST until the socket speaks again. */
export const WS_QUIET_MS = 5_000;
const WS_RETRY_MIN_MS = 1_000;
const WS_RETRY_MAX_MS = 30_000;

/** One `ticker` message → the trade it reports, or null for anything else (subscriptions, heartbeats, other products). */
export function parseCoinbaseTicker(raw: string, symbols: readonly string[]): { symbol: CryptoSymbol; price: string; timeMs: number } | null {
  let body: { type?: unknown; product_id?: unknown; price?: unknown; time?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return null;
  }
  if (body.type !== "ticker" || typeof body.product_id !== "string" || typeof body.price !== "string") return null;
  const symbol = body.product_id.endsWith("-USD") ? body.product_id.slice(0, -4) : null;
  if (!symbol || !symbols.includes(symbol)) return null;
  const timeMs = typeof body.time === "string" ? Date.parse(body.time) : Number.NaN;
  if (!/^\d+(\.\d+)?$/.test(body.price)) return null;
  return { symbol: symbol as CryptoSymbol, price: body.price, timeMs: Number.isFinite(timeMs) ? timeMs : Date.now() };
}

const defaultSocket: SocketFactory | null = typeof globalThis.WebSocket === "function" ? (url) => new globalThis.WebSocket(url) as unknown as SocketLike : null;

export function createCryptoSpotFeed(input: {
  log: (why: string) => void;
  symbols?: readonly CryptoSymbol[];
  fetchImpl?: Fetch;
  everyMs?: number;
  /** Null turns the socket off (REST only); absent uses Node's global `WebSocket`. */
  socket?: SocketFactory | null;
}): CryptoSpotHandle {
  const symbols = input.symbols ?? CRYPTO_SYMBOLS;
  const fetchImpl = input.fetchImpl ?? (fetch as Fetch);
  const makeSocket = input.socket === undefined ? defaultSocket : input.socket;
  const quotes = new Map<string, SpotQuote>();
  /** Wall time of each symbol's last socket trade. */
  const heardMs = new Map<string, number>();
  const listeners = new Set<(q: SpotQuote) => void>();
  const beat = registerHeartbeat("crypto-spot", false, input.everyMs ?? EVERY_MS);
  let timer: ReturnType<typeof setInterval> | null = null;
  let socket: SocketLike | null = null;
  let socketRetry: ReturnType<typeof setTimeout> | null = null;
  let socketRetryMs = WS_RETRY_MIN_MS;
  let running = false;
  let lastError = "";

  const publish = (quote: SpotQuote) => {
    const prev = quotes.get(quote.symbol);
    if (prev && (prev.publishTimeMs ?? prev.publishTimeSec * 1000) > (quote.publishTimeMs ?? quote.publishTimeSec * 1000)) return;
    quotes.set(quote.symbol, quote);
    if (!prev || prev.priceE8 !== quote.priceE8 || prev.publishTimeSec !== quote.publishTimeSec) for (const l of listeners) l(quote);
  };

  const poll = async (symbol: CryptoSymbol) => {
    if (Date.now() - (heardMs.get(symbol) ?? 0) < WS_QUIET_MS) return;
    const r = await fetchImpl(`https://api.exchange.coinbase.com/products/${symbol}-USD/ticker`, { headers: { "user-agent": "owarine-crypto-spot" }, signal: AbortSignal.timeout(4_000) });
    if (!r.ok) throw new Error(`coinbase ticker ${symbol} HTTP ${r.status}`);
    const body = JSON.parse(await r.text()) as { price?: string; time?: string };
    if (typeof body.price !== "string") throw new Error(`coinbase ticker ${symbol}: no price`);
    const timeMs = body.time ? Date.parse(body.time) : Date.now();
    publish({ symbol, priceE8: decimalToE8(body.price), publishTimeSec: Math.floor(timeMs / 1000), publishTimeMs: timeMs, source: "exchange" });
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
    const viaSocket = symbols.filter((s) => Date.now() - (heardMs.get(s) ?? 0) < WS_QUIET_MS);
    beat.lastWhy = `${[...quotes.values()].map((q) => `${q.symbol} ${q.priceE8}`).join(", ") || "no quote yet"} · socket ${viaSocket.length}/${symbols.length}`;
  };

  const openSocket = () => {
    if (!running || !makeSocket || socket) return;
    let ws: SocketLike;
    try {
      ws = makeSocket(COINBASE_WS_URL);
    } catch (error) {
      input.log(`crypto spot socket: ${errorText(error)}`);
      return scheduleSocket();
    }
    socket = ws;
    ws.onopen = () => {
      socketRetryMs = WS_RETRY_MIN_MS;
      ws.send(JSON.stringify({ type: "subscribe", product_ids: symbols.map((s) => `${s}-USD`), channels: ["ticker"] }));
      input.log(`crypto spot socket open: ${symbols.join(", ")}`);
    };
    ws.onmessage = (event) => {
      const trade = typeof event.data === "string" ? parseCoinbaseTicker(event.data, symbols) : null;
      if (!trade) return;
      heardMs.set(trade.symbol, Date.now());
      publish({ symbol: trade.symbol, priceE8: decimalToE8(trade.price), publishTimeSec: Math.floor(trade.timeMs / 1000), publishTimeMs: trade.timeMs, source: "exchange" });
    };
    ws.onerror = () => undefined;
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      scheduleSocket();
    };
  };

  const scheduleSocket = () => {
    if (!running || socketRetry) return;
    socketRetry = setTimeout(() => {
      socketRetry = null;
      openSocket();
    }, socketRetryMs);
    socketRetryMs = Math.min(socketRetryMs * 2, WS_RETRY_MAX_MS);
  };

  return {
    start() {
      if (running) return;
      running = true;
      openSocket();
      void tick();
      timer = setInterval(() => void tick(), input.everyMs ?? EVERY_MS);
    },
    stop() {
      running = false;
      if (timer) clearInterval(timer);
      timer = null;
      if (socketRetry) clearTimeout(socketRetry);
      socketRetry = null;
      const ws = socket;
      socket = null;
      ws?.close();
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
