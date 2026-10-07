import { attestedPrintSource, parsePrintSource } from "@owarine/core/market";
import { describe, expect, it } from "vitest";
import { alpacaTradeAt, createAttestedReader, jupiterBarAt } from "./attested-read";
import { alpacaLatestQuotes } from "./spot-feed";
import type { XStockSpotQuote } from "./xstock-spot";

const T = 1_790_694_000; // 2026-09-29T15:00:00Z
const iso = (sec: number, frac = ".240016968") => `${new Date(sec * 1000).toISOString().slice(0, 19)}${frac}Z`;

describe("Alpaca IEX print (C6e, K-070)", () => {
  it("takes the newest trade at or before T, to the cent, and refuses a stale or missing one", () => {
    const body = JSON.stringify({ symbol: "QQQ", trades: [{ p: 737.49, s: 40, t: iso(T - 5) }, { p: 737.1, t: iso(T - 30) }] });
    expect(alpacaTradeAt(body, T)).toEqual({ price: "737.49000000", atSec: T - 5 });
    expect(alpacaTradeAt(JSON.stringify({ trades: [{ p: 1, t: iso(T - 301) }] }), T)).toEqual({ error: "the last IEX trade was 301 s before T" });
    expect(alpacaTradeAt(JSON.stringify({ trades: [] }), T)).toMatchObject({ error: expect.stringContaining("no IEX trade") });
    expect(alpacaTradeAt(JSON.stringify({ trades: null }), T)).toMatchObject({ error: expect.stringContaining("no IEX trade") });
    // A trade after T is never T's price.
    expect(alpacaTradeAt(JSON.stringify({ trades: [{ p: 2, t: iso(T + 1, ".000") }] }), T)).toMatchObject({ error: expect.any(String) });
  });

  it("the oracle reads it from T + 5 with the keys in headers, never in the URL, and names the source", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string> });
      return new Response(JSON.stringify({ trades: [{ p: 701.91, t: iso(T - 7) }] }));
    }) as unknown as typeof fetch;
    const reader = createAttestedReader({ sources: { gateways: [], redstoneSigners: new Set(), redstoneThreshold: 3 }, switchboardFeeds: new Map(), prestocks: () => null, alpaca: { keyId: "kid", secretKey: "sk" }, fetchImpl });
    const parts = parsePrintSource(attestedPrintSource("alpaca", "VOO"))!;
    const slot = { boundarySec: T, earliestSec: T + 5, deadlineSec: T + 900 };
    expect((await reader.read(parts, slot, T + 2)).kind).toBe("wait");
    const out = await reader.read(parts, slot, T + 6);
    expect(out).toMatchObject({ kind: "ok", read: { priceE8: 70_191_000_000n, fetchedAtSec: T + 6, signers: 1 } });
    expect(calls[0]!.url).toContain("/stocks/VOO/trades?");
    expect(calls[0]!.url).toContain("feed=iex");
    expect(calls[0]!.url).not.toContain("kid");
    expect(calls[0]!.headers).toEqual({ "APCA-API-KEY-ID": "kid", "APCA-API-SECRET-KEY": "sk" });
    const keyless = createAttestedReader({ sources: { gateways: [], redstoneSigners: new Set(), redstoneThreshold: 3 }, switchboardFeeds: new Map(), prestocks: () => null });
    expect(await keyless.read(parts, slot, T + 6)).toEqual({ kind: "missed", why: "ALPACA_KEY_ID / ALPACA_SECRET_KEY are not set" });
  });

  it("the spot poll parses the latest trades per symbol into e-8 quotes", () => {
    const body = JSON.stringify({ trades: { QQQ: { p: 737.92, t: iso(T) }, VOO: { p: 0, t: iso(T) } } });
    expect(alpacaLatestQuotes(body, ["QQQ", "VOO"])).toEqual([{ symbol: "QQQ", priceE8: 73_792_000_000n, publishTimeSec: T, source: "alpaca" }]);
  });
});

describe("Jupiter median print (C6e, K-070)", () => {
  const sample = (sec: number, priceE8: bigint): XStockSpotQuote => ({ xstock: "TSLAx", priceE8, sampledSec: sec, source: "jupiter" });
  const feedOf = (samples: XStockSpotQuote[]) => ({
    at: (_x: string, sec: number, windowSec = 5) => [...samples].reverse().find((q) => q.sampledSec <= sec && q.sampledSec >= sec - windowSec) ?? null,
  });

  it("is the median of the samples at T − 40, T − 20 and T, each the newest in the 5 s before its point", () => {
    const feed = feedOf([sample(T - 44, 35_000_000_000n), sample(T - 41, 35_400_000_000n), sample(T - 22, 35_100_000_000n), sample(T - 3, 35_200_000_000n), sample(T + 2, 99n)]);
    const bar = jupiterBarAt(feed, "TSLAx", T);
    expect(bar).toMatchObject({ medianE8: 35_200_000_000n });
    expect("samples" in bar && bar.samples.map((s) => s.sampledSec)).toEqual([T - 41, T - 22, T - 3]);
  });

  it("misses (the Window voids) rather than attesting fewer points", async () => {
    const feed = feedOf([sample(T - 41, 1n), sample(T - 3, 3n)]);
    expect(jupiterBarAt(feed, "TSLAx", T)).toEqual({ missing: "TSLAx Jupiter sample missing at T-20" });
    const reader = createAttestedReader({ sources: { gateways: [], redstoneSigners: new Set(), redstoneThreshold: 3 }, switchboardFeeds: new Map(), prestocks: () => null, xstock: () => feed });
    const slot = { boundarySec: T, earliestSec: T + 5, deadlineSec: T + 60 };
    expect(await reader.read(parsePrintSource("attested:jupiter:TSLAx")!, slot, T + 6)).toEqual({ kind: "missed", why: "TSLAx Jupiter sample missing at T-20" });
    expect(await reader.read(parsePrintSource("attested:jupiter:TSLA")!, slot, T + 6)).toEqual({ kind: "missed", why: "TSLA is not an xStock" });
  });
});
