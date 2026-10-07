import { afterEach, describe, expect, it, vi } from "vitest";
import { bybitCandles, bybitInterval, convertE8, createBybitSpotFeed, createUsdtRate, joinBybitSpot, parseBybitKlines, parseBybitTrade } from "./bybit";
import type { Fetch } from "./candles";
import type { SocketLike } from "./crypto-spot";
import type { SpotFeed, SpotQuote } from "./spot";

const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
const usdtAt = (price: string): Fetch => (async () => reply({ price })) as unknown as Fetch;

describe("convertE8", () => {
  it("prices CC/USDT in dollars at the USDT-USD rate, rounded half up at 10⁻⁸", () => {
    expect(convertE8("0.11999", 0.99946)).toBe(11_992_521n); // 0.11999 × 0.99946 = 0.1199252054 → 11,992,520.54 up
    expect(convertE8("0.12", 1)).toBe(12_000_000n);
  });
});

describe("createUsdtRate", () => {
  it("caches a good read and refuses a rate outside the 0.97–1.03 band, keeping the last good one", async () => {
    let price = "0.9995";
    let reads = 0;
    let now = 0;
    const rate = createUsdtRate((async () => (reads++, reply({ price }))) as unknown as Fetch, () => now);
    expect(await rate.get()).toBe(0.9995);
    expect(await rate.get()).toBe(0.9995);
    expect(reads).toBe(1);
    price = "0.5";
    now = 31_000;
    expect(await rate.get()).toBe(0.9995);
    expect(reads).toBe(2);
  });
});

describe("parseBybitTrade", () => {
  it("takes the newest trade of a publicTrade batch", () => {
    const msg = { topic: "publicTrade.CCUSDT", data: [{ T: 2, s: "CCUSDT", p: "0.12014" }, { T: 1, s: "CCUSDT", p: "0.12000" }] };
    expect(parseBybitTrade(JSON.stringify(msg))).toEqual({ pair: "CCUSDT", price: "0.12014", timeMs: 2 });
  });
  it("ignores acks, pongs, other topics and bad prices", () => {
    expect(parseBybitTrade(JSON.stringify({ success: true, op: "subscribe" }))).toBeNull();
    expect(parseBybitTrade(JSON.stringify({ topic: "orderbook.1.CCUSDT", data: [] }))).toBeNull();
    expect(parseBybitTrade(JSON.stringify({ topic: "publicTrade.CCUSDT", data: [{ T: 1, s: "CCUSDT", p: "-1" }] }))).toBeNull();
    expect(parseBybitTrade("not json")).toBeNull();
  });
});

describe("klines", () => {
  it("maps every chart interval to Bybit's and nothing else", () => {
    expect([60, 180, 300, 900, 1800, 3600, 7200, 14_400, 43_200, 86_400].map(bybitInterval)).toEqual(["1", "3", "5", "15", "30", "60", "120", "240", "720", "D"]);
    expect(bybitInterval(120)).toBeNull();
  });
  it("turns newest-first string rows into ascending [t, o, h, l, c] in dollars", () => {
    const text = JSON.stringify({ retCode: 0, result: { list: [["120000", "2", "4", "1", "3", "9", "9"], ["60000", "1", "2", "0.5", "2", "9", "9"]] } });
    expect(parseBybitKlines(text, 0.5)).toEqual([[60_000, 0.5, 1, 0.25, 1], [120_000, 1, 2, 0.5, 1.5]]);
    expect(() => parseBybitKlines(JSON.stringify({ retCode: 10001, retMsg: "params error" }), 1)).toThrow("params error");
  });
  it("asks Bybit for the pair, interval, end and count, and converts with the rate", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return url.includes("USDT-USD") ? reply({ price: "1.0000" }) : reply({ retCode: 0, result: { list: [["60000", "0.12", "0.12", "0.12", "0.12", "1", "1"]] } });
    }) as unknown as Fetch;
    const rows = await bybitCandles(fetchImpl, createUsdtRate(fetchImpl), "CC", 300, 50, 999_000);
    expect(rows).toEqual([[60_000, 0.12, 0.12, 0.12, 0.12]]);
    expect(urls[0]).toContain("symbol=CCUSDT&interval=5&end=999000&limit=50");
  });
});

class FakeSocket implements SocketLike {
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
}

describe("createBybitSpotFeed", () => {
  afterEach(() => vi.useRealTimers());

  it("subscribes to CC trades and publishes them in dollars once the rate is known", async () => {
    const ws = new FakeSocket();
    const rate = createUsdtRate(usdtAt("0.9995"));
    await rate.get();
    const feed = createBybitSpotFeed({ log: () => undefined, rate, socket: () => ws, fetchImpl: usdtAt("0.9995"), everyMs: 60_000 });
    const seen: SpotQuote[] = [];
    feed.subscribe((q) => seen.push(q));
    feed.start();
    ws.onopen?.();
    expect(JSON.parse(ws.sent[0]!)).toEqual({ op: "subscribe", args: ["publicTrade.CCUSDT"] });
    const nowMs = Date.now();
    ws.onmessage?.({ data: JSON.stringify({ topic: "publicTrade.CCUSDT", data: [{ T: nowMs, s: "CCUSDT", p: "0.12" }] }) });
    expect(seen.map((q) => [q.symbol, q.priceE8, q.source])).toEqual([["CC", 11_994_000n, "exchange"]]);
    expect(feed.latest("CC")?.publishTimeMs).toBe(nowMs);
    feed.stop();
  });

  it("drops a trade that arrives before any USDT-USD rate rather than price it in USDT", () => {
    const ws = new FakeSocket();
    const feed = createBybitSpotFeed({ log: () => undefined, rate: createUsdtRate(usdtAt("x")), socket: () => ws, fetchImpl: usdtAt("x"), everyMs: 60_000 });
    feed.start();
    ws.onopen?.();
    ws.onmessage?.({ data: JSON.stringify({ topic: "publicTrade.CCUSDT", data: [{ T: Date.now(), s: "CCUSDT", p: "0.12" }] }) });
    expect(feed.latest("CC")).toBeNull();
    feed.stop();
  });
});

describe("joinBybitSpot", () => {
  it("routes Canton Coin to Bybit and everything else to the base feed", () => {
    const q = (symbol: string): SpotQuote => ({ symbol: symbol as SpotQuote["symbol"], priceE8: 1n, publishTimeSec: 1, source: "exchange" });
    const feed = (name: string): SpotFeed => ({ latest: (s) => ({ ...q(s), priceE8: name === "bybit" ? 2n : 1n }), subscribe: () => () => undefined });
    const joined = joinBybitSpot(feed("coinbase"), feed("bybit"));
    expect(joined.latest("CC")?.priceE8).toBe(2n);
    expect(joined.latest("BTC")?.priceE8).toBe(1n);
  });
});
