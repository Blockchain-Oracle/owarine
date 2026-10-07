import { afterEach, describe, expect, it, vi } from "vitest";
import { createCryptoSpotFeed, parseCoinbaseTicker, WS_QUIET_MS, type SocketLike } from "./crypto-spot";
import type { SpotQuote } from "./spot";

const TICKER = (price: string, time = "2026-10-07T12:00:00.123456Z", product = "BTC-USD") => JSON.stringify({ type: "ticker", product_id: product, price, time, sequence: 1 });

describe("parseCoinbaseTicker", () => {
  it("reads a ticker trade with millisecond time", () => {
    expect(parseCoinbaseTicker(TICKER("62000.01"), ["BTC", "ETH"])).toEqual({ symbol: "BTC", price: "62000.01", timeMs: Date.parse("2026-10-07T12:00:00.123Z") });
  });
  it("ignores subscriptions, heartbeats, other products and bad prices", () => {
    expect(parseCoinbaseTicker(JSON.stringify({ type: "subscriptions", channels: [] }), ["BTC"])).toBeNull();
    expect(parseCoinbaseTicker(TICKER("1", undefined, "SOL-USD"), ["BTC"])).toBeNull();
    expect(parseCoinbaseTicker(TICKER("-1"), ["BTC"])).toBeNull();
    expect(parseCoinbaseTicker("not json", ["BTC"])).toBeNull();
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

describe("createCryptoSpotFeed over the socket", () => {
  afterEach(() => vi.useRealTimers());

  it("subscribes, publishes every trade and skips REST while the socket speaks", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-10-07T12:00:00Z") });
    const sockets: FakeSocket[] = [];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ price: "61000", time: "2026-10-07T12:00:00Z" })));
    const feed = createCryptoSpotFeed({ log: () => undefined, symbols: ["BTC"], fetchImpl, socket: () => (sockets.push(new FakeSocket()), sockets.at(-1)!) });
    const seen: SpotQuote[] = [];
    feed.subscribe((q) => seen.push(q));
    feed.start();
    const ws = sockets[0]!;
    ws.onopen?.();
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] });
    ws.onmessage?.({ data: TICKER("62000.5", "2026-10-07T12:00:00.250Z") });
    ws.onmessage?.({ data: TICKER("62001", "2026-10-07T12:00:00.500Z") });
    expect(seen.map((q) => q.priceE8)).toContain(6_200_100_000_000n);
    expect(feed.latest("BTC")?.publishTimeMs).toBe(Date.parse("2026-10-07T12:00:00.500Z"));
    fetchImpl.mockClear();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchImpl).not.toHaveBeenCalled();
    feed.stop();
  });

  it("falls back to REST once the socket has been quiet and reconnects after a close", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-10-07T12:00:00Z") });
    const sockets: FakeSocket[] = [];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ price: "61000", time: new Date().toISOString() })));
    const feed = createCryptoSpotFeed({ log: () => undefined, symbols: ["BTC"], fetchImpl, socket: () => (sockets.push(new FakeSocket()), sockets.at(-1)!) });
    feed.start();
    sockets[0]!.onopen?.();
    sockets[0]!.onmessage?.({ data: TICKER("62000", new Date().toISOString()) });
    fetchImpl.mockClear();
    sockets[0]!.onclose?.();
    await vi.advanceTimersByTimeAsync(WS_QUIET_MS + 2_000);
    expect(fetchImpl).toHaveBeenCalled();
    expect(sockets.length).toBeGreaterThan(1);
    feed.stop();
  });
});
