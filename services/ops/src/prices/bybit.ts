/**
 * Canton Coin's market data (revamp 2b): Bybit's CC/USDT spot book, the deepest CC market (~$3M a day, 7 Oct 2026),
 * converted to USD at Coinbase Exchange's USDT-USD last trade. RedStone's `CC` feed, which the CC Windows settle on, is
 * itself USD: measured against it, Bybit × USDT-USD sat within ~3 bps and raw CC/USDT ~8 bps off, a phantom move the
 * pricer would read against the Window's open print. Bitstamp's CC/USD was 45 bps stale (minutes with no trade).
 *
 * Display and pricing only, like every other spot: nothing here settles. Public, keyless endpoints:
 *   wss://stream.bybit.com/v5/public/spot   `publicTrade.CCUSDT`, every trade; a ping every 20 s keeps it open
 *   /v5/market/tickers?category=spot        last price, 24 h open/high/low/volume (REST fallback and day figures)
 *   /v5/market/kline?category=spot         candles, newest first, ≤ 1,000 a read, intervals 1…720 min and D
 *   Coinbase /products/USDT-USD/ticker      the conversion, read at most every 30 s
 */
import { CANTON_COIN, type Close } from "@owarine/core/market";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import { decimalToE8, type Fetch } from "./candles";
import { createCryptoSpotFeed, type CryptoSpotHandle, type SocketFactory, type SocketLike } from "./crypto-spot";
import type { SpotFeed, SpotQuote } from "./spot";

export const BYBIT_REST = "https://api.bybit.com";
export const BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/spot";
/** The symbols Bybit prices here, by registry symbol. */
export const BYBIT_PAIRS: Readonly<Record<string, string>> = { [CANTON_COIN]: "CCUSDT" };
export const isBybitSymbol = (symbol: string): boolean => symbol in BYBIT_PAIRS;

const UA = { "user-agent": "owarine-bybit" };
const RATE_MS = 30_000;
const PING_MS = 20_000;
const WS_QUIET_MS = 5_000;
const EVERY_MS = 2_000;
const WS_RETRY_MIN_MS = 1_000;
const WS_RETRY_MAX_MS = 30_000;
const DEFAULT_MAX_AGE_SEC = 30;
/** A USDT-USD rate outside this band is a bad read, not a depeg the venue should price through: the last good one stays. */
const RATE_BAND: readonly [number, number] = [0.97, 1.03];

/** A decimal string × a rate, as × 10⁸ (rounded half up). The rate carries at most 8 decimals. */
export function convertE8(price: string, rate: number): bigint {
  const rateE8 = BigInt(Math.round(rate * 1e8));
  return (decimalToE8(price) * rateE8 + 50_000_000n) / 100_000_000n;
}

/** USDT → USD, cached for 30 s; null before the first good read. */
export function createUsdtRate(fetchImpl: Fetch = fetch as Fetch, nowMs: () => number = Date.now) {
  let rate: { value: number; atMs: number } | null = null;
  let inflight: Promise<number | null> | null = null;
  const read = async (): Promise<number | null> => {
    try {
      const r = await fetchImpl("https://api.exchange.coinbase.com/products/USDT-USD/ticker", { headers: UA, signal: AbortSignal.timeout(5_000) });
      if (!r.ok) return rate?.value ?? null;
      const v = Number((JSON.parse(await r.text()) as { price?: string }).price);
      if (Number.isFinite(v) && v >= RATE_BAND[0] && v <= RATE_BAND[1]) rate = { value: v, atMs: nowMs() };
    } catch {
      // Keep the last good rate.
    }
    return rate?.value ?? null;
  };
  return {
    async get(): Promise<number | null> {
      if (rate && nowMs() - rate.atMs < RATE_MS) return rate.value;
      inflight ??= read().finally(() => (inflight = null));
      return inflight;
    },
    /** The cached rate without a read (the socket path converts with it synchronously). */
    peek: (): number | null => rate?.value ?? null,
  };
}
export type UsdtRate = ReturnType<typeof createUsdtRate>;

/** One `publicTrade` message → its newest trade, or null for anything else (acks, pongs, other topics). */
export function parseBybitTrade(raw: string): { pair: string; price: string; timeMs: number } | null {
  let body: { topic?: unknown; data?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return null;
  }
  if (typeof body.topic !== "string" || !body.topic.startsWith("publicTrade.") || !Array.isArray(body.data)) return null;
  let best: { pair: string; price: string; timeMs: number } | null = null;
  for (const t of body.data as Array<{ s?: unknown; p?: unknown; T?: unknown }>) {
    if (typeof t.s !== "string" || typeof t.p !== "string" || !/^\d+(\.\d+)?$/.test(t.p) || typeof t.T !== "number") continue;
    if (!best || t.T >= best.timeMs) best = { pair: t.s, price: t.p, timeMs: t.T };
  }
  return best;
}

/** Bybit's ticker row for a pair, or null. */
async function tickerRow(fetchImpl: Fetch, pair: string): Promise<Record<string, string> | null> {
  const r = await fetchImpl(`${BYBIT_REST}/v5/market/tickers?category=spot&symbol=${pair}`, { headers: UA, signal: AbortSignal.timeout(5_000) });
  if (!r.ok) throw new Error(`bybit ticker ${pair} HTTP ${r.status}`);
  const body = JSON.parse(await r.text()) as { retCode?: number; retMsg?: string; result?: { list?: Record<string, string>[] } };
  if (body.retCode !== 0) throw new Error(`bybit ticker ${pair}: ${body.retMsg ?? "retCode " + body.retCode}`);
  return body.result?.list?.[0] ?? null;
}

/** The Bybit spot feed: the socket's trades, the REST ticker for a symbol the socket has been quiet on, both in USD. */
export function createBybitSpotFeed(input: {
  log: (why: string) => void;
  rate: UsdtRate;
  fetchImpl?: Fetch;
  everyMs?: number;
  socket?: SocketFactory | null;
}): CryptoSpotHandle {
  const fetchImpl = input.fetchImpl ?? (fetch as Fetch);
  const makeSocket: SocketFactory | null =
    input.socket === undefined ? (typeof globalThis.WebSocket === "function" ? (url) => new globalThis.WebSocket(url) as unknown as SocketLike : null) : input.socket;
  const symbolOfPair = new Map(Object.entries(BYBIT_PAIRS).map(([symbol, pair]) => [pair, symbol]));
  const quotes = new Map<string, SpotQuote>();
  const heardMs = new Map<string, number>();
  const listeners = new Set<(q: SpotQuote) => void>();
  const beat = registerHeartbeat("bybit-spot", false, input.everyMs ?? EVERY_MS);
  let timer: ReturnType<typeof setInterval> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let socket: SocketLike | null = null;
  let socketRetry: ReturnType<typeof setTimeout> | null = null;
  let socketRetryMs = WS_RETRY_MIN_MS;
  let running = false;
  let lastError = "";

  const publish = (symbol: string, price: string, timeMs: number, rate: number) => {
    const quote: SpotQuote = { symbol: symbol as SpotQuote["symbol"], priceE8: convertE8(price, rate), publishTimeSec: Math.floor(timeMs / 1000), publishTimeMs: timeMs, source: "exchange" };
    const prev = quotes.get(symbol);
    if (prev && (prev.publishTimeMs ?? 0) > timeMs) return;
    quotes.set(symbol, quote);
    if (!prev || prev.priceE8 !== quote.priceE8 || prev.publishTimeSec !== quote.publishTimeSec) for (const l of listeners) l(quote);
  };

  const poll = async (symbol: string) => {
    const rate = await input.rate.get();
    if (rate === null) throw new Error("no USDT-USD rate yet");
    if (Date.now() - (heardMs.get(symbol) ?? 0) < WS_QUIET_MS) return;
    const row = await tickerRow(fetchImpl, BYBIT_PAIRS[symbol]!);
    if (!row?.lastPrice) throw new Error(`bybit ticker ${symbol}: no price`);
    publish(symbol, row.lastPrice, Date.now(), rate);
  };

  const tick = async () => {
    const symbols = Object.keys(BYBIT_PAIRS);
    const results = await Promise.allSettled(symbols.map(poll));
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    beat.lastPassMs = Date.now();
    if (failed.length === 0) {
      beat.lastOkMs = Date.now();
      beat.failures = 0;
    } else {
      beat.failures += 1;
      const why = errorText(failed[0]!.reason);
      if (why !== lastError) input.log(`bybit spot: ${why}`);
      lastError = why;
    }
    const viaSocket = symbols.filter((s) => Date.now() - (heardMs.get(s) ?? 0) < WS_QUIET_MS);
    beat.lastWhy = `${[...quotes.values()].map((q) => `${q.symbol} ${q.priceE8}`).join(", ") || "no quote yet"} · USDT-USD ${input.rate.peek() ?? "?"} · socket ${viaSocket.length}/${symbols.length}`;
  };

  const scheduleSocket = () => {
    if (!running || socketRetry) return;
    socketRetry = setTimeout(() => {
      socketRetry = null;
      openSocket();
    }, socketRetryMs);
    socketRetryMs = Math.min(socketRetryMs * 2, WS_RETRY_MAX_MS);
  };

  const openSocket = () => {
    if (!running || !makeSocket || socket) return;
    let ws: SocketLike;
    try {
      ws = makeSocket(BYBIT_WS_URL);
    } catch (error) {
      input.log(`bybit spot socket: ${errorText(error)}`);
      return scheduleSocket();
    }
    socket = ws;
    ws.onopen = () => {
      socketRetryMs = WS_RETRY_MIN_MS;
      ws.send(JSON.stringify({ op: "subscribe", args: Object.values(BYBIT_PAIRS).map((p) => `publicTrade.${p}`) }));
      if (ping) clearInterval(ping);
      ping = setInterval(() => socket === ws && ws.send(JSON.stringify({ op: "ping" })), PING_MS);
      input.log(`bybit spot socket open: ${Object.keys(BYBIT_PAIRS).join(", ")}`);
    };
    ws.onmessage = (event) => {
      const trade = typeof event.data === "string" ? parseBybitTrade(event.data) : null;
      const symbol = trade ? symbolOfPair.get(trade.pair) : undefined;
      const rate = input.rate.peek();
      if (!trade || !symbol || rate === null) return;
      heardMs.set(symbol, Date.now());
      publish(symbol, trade.price, trade.timeMs, rate);
    };
    ws.onerror = () => undefined;
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      if (ping) clearInterval(ping);
      ping = null;
      scheduleSocket();
    };
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
      for (const t of [timer, ping]) if (t) clearInterval(t);
      timer = ping = null;
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

/** The Bybit feed for its symbols, else `base`. */
export function joinBybitSpot(base: SpotFeed, bybit: SpotFeed): SpotFeed {
  return {
    latest: (symbol, maxAgeSec) => (isBybitSymbol(symbol) ? bybit.latest(symbol, maxAgeSec) : base.latest(symbol, maxAgeSec)),
    subscribe(listener) {
      const offs = [base.subscribe(listener), bybit.subscribe(listener)];
      return () => offs.forEach((off) => off());
    },
  };
}

/** Every crypto asset's spot as one feed: Coinbase for BTC and ETH, Bybit for Canton Coin. */
export function createCryptoAssetSpotFeed(log: (why: string) => void, rate: UsdtRate = createUsdtRate()): CryptoSpotHandle {
  const coinbase = createCryptoSpotFeed({ log });
  const bybit = createBybitSpotFeed({ log, rate });
  const joined = joinBybitSpot(coinbase, bybit);
  return {
    ...joined,
    start: () => [coinbase, bybit].forEach((f) => f.start()),
    stop: () => [coinbase, bybit].forEach((f) => f.stop()),
  };
}

/** Bybit's kline interval for a bar length in seconds (its set: 1 3 5 15 30 60 120 240 360 720 min, D). */
export function bybitInterval(sec: number): string | null {
  if (sec === 86_400) return "D";
  const min = sec / 60;
  return [1, 3, 5, 15, 30, 60, 120, 240, 360, 720].includes(min) ? String(min) : null;
}

/** Kline rows `[startMs, open, high, low, close, volume, turnover]` (strings, newest first) → ascending `[tMs, o, h, l, c]` × rate. */
export function parseBybitKlines(text: string, rate: number): Array<[number, number, number, number, number]> {
  const body = JSON.parse(text) as { retCode?: number; retMsg?: string; result?: { list?: unknown[] } };
  if (body.retCode !== 0 || !Array.isArray(body.result?.list)) throw new Error(`bybit kline: ${body.retMsg ?? text.slice(0, 120)}`);
  return (body.result.list as unknown[][])
    .filter((r) => Array.isArray(r) && r.length >= 5)
    .map((r) => [Number(r[0]), Number(r[1]) * rate, Number(r[2]) * rate, Number(r[3]) * rate, Number(r[4]) * rate] as [number, number, number, number, number])
    .filter((r) => r.every(Number.isFinite))
    .sort((a, b) => a[0] - b[0]);
}

/** Candles for a Bybit symbol in USD, oldest first; the newest row is the bar still forming. */
export async function bybitCandles(fetchImpl: Fetch, rate: UsdtRate, symbol: string, sec: number, count: number, endMs: number): Promise<Array<[number, number, number, number, number]>> {
  const interval = bybitInterval(sec);
  if (!interval) throw new Error(`bybit has no ${sec} s interval`);
  const r = await fetchImpl(`${BYBIT_REST}/v5/market/kline?category=spot&symbol=${BYBIT_PAIRS[symbol]}&interval=${interval}&end=${endMs}&limit=${Math.min(1_000, count)}`, { headers: UA, signal: AbortSignal.timeout(6_000) });
  if (!r.ok) throw new Error(`bybit kline HTTP ${r.status}`);
  const usd = await rate.get();
  if (usd === null) throw new Error("no USDT-USD rate yet");
  return parseBybitKlines(await r.text(), usd);
}

/** Committed 1-minute closes in `[fromSec, toSec)` for the vol meter (a ratio of prices, so no conversion). */
export async function bybitCloseHistory(symbol: string, fromSec: number, toSec: number, fetchImpl: Fetch = fetch as Fetch): Promise<Close[]> {
  const out = new Map<number, number>();
  let end = toSec * 1000 - 1;
  while (end > fromSec * 1000) {
    const r = await fetchImpl(`${BYBIT_REST}/v5/market/kline?category=spot&symbol=${BYBIT_PAIRS[symbol]}&interval=1&end=${end}&limit=1000`, { headers: UA, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`bybit kline HTTP ${r.status}`);
    const rows = parseBybitKlines(await r.text(), 1);
    if (rows.length === 0) break;
    for (const [tMs, , , , c] of rows) if (tMs >= fromSec * 1000 && tMs + 60_000 <= toSec * 1000) out.set(tMs / 1000, c);
    end = rows[0]![0] - 1;
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([sec, price]) => ({ sec, price }));
}

/** 24-hour figures for a Bybit symbol in USD (`/prices/day`'s row), or null. */
export async function bybitDay(fetchImpl: Fetch, rate: UsdtRate, symbol: string): Promise<{ openE8: string; highE8: string; lowE8: string; volume: string } | null> {
  const row = await tickerRow(fetchImpl, BYBIT_PAIRS[symbol]!);
  const usd = await rate.get();
  if (!row || usd === null || !row.prevPrice24h || !row.highPrice24h || !row.lowPrice24h) return null;
  return {
    openE8: convertE8(row.prevPrice24h, usd).toString(),
    highE8: convertE8(row.highPrice24h, usd).toString(),
    lowE8: convertE8(row.lowPrice24h, usd).toString(),
    volume: row.volume24h ?? "0",
  };
}
