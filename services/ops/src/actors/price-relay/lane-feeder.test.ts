import { afterEach, describe, expect, it, vi } from "vitest";
import { attestedPrintSource, EXCHANGE_PRINT_SOURCE } from "@owarine/core/market";
import type { TermsC } from "@owarine/markets/ops/canton";
import { createAttestedReader, surgeValueOf } from "../../prices/attested-read";
import { laneSlots, lanePrintCommandId } from "./lane-feeder";

const T = 1_790_690_400; // 2026-09-29T14:00:00Z, a Regular boundary
const terms = (over: Partial<TermsC>): TermsC => ({
  venue: "venue::1", resolver: "resolver::1", seriesKey: "TSLA-5m", marketId: "TSLA-5m:7", index: 7, symbol: "TSLA", cashUnit: 1000n,
  tradingStartSec: T, lockAtSec: T + 270, expirySec: T + 300, openDeadlineSec: T + 900, closeDeadlineSec: T + 1_200, refundAfterSec: T + 1_500,
  policyVersion: 2, printSource: attestedPrintSource("redstone", "TSLA"), minDelaySec: 5, barLenSec: 1, tieUp: true,
  oracles: ["o1", "o2", "o3"], quorum: 2, maxDeviationBps: 100, ...over,
});

describe("lane slots (C6)", () => {
  it("one print serves a 5 m close, the next 5 m open and a 15 m open at the same T, with the widest deadline", () => {
    const slots = laneSlots([
      { terms: terms({ marketId: "TSLA-5m:6", tradingStartSec: T - 300, expirySec: T, closeDeadlineSec: T + 900 }), slot: "close" },
      { terms: terms({ marketId: "TSLA-5m:7" }), slot: "open" },
      { terms: terms({ seriesKey: "TSLA-15m", marketId: "TSLA-15m:3", openDeadlineSec: T + 950 }), slot: "open" },
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ symbol: "TSLA", boundarySec: T, earliestSec: T + 5, deadlineSec: T + 950, barLenSec: 1, policyVersion: 2, parts: { source: "redstone", feed: "TSLA" } });
    expect(slots[0]!.markets).toEqual(["TSLA-5m:6 close", "TSLA-5m:7 open", "TSLA-15m:3 open"]);
  });

  it("leaves crypto (the minute feeders) and committee events alone, and keeps different versions apart", () => {
    const slots = laneSlots([
      { terms: terms({ symbol: "BTC", seriesKey: "BTC-5m", printSource: EXCHANGE_PRINT_SOURCE, barLenSec: 60 }), slot: "open" },
      { terms: terms({ symbol: "EVT-DEMO-1", seriesKey: "EVT-DEMO-1", printSource: attestedPrintSource("committee", "DEMO-1") }), slot: "open" },
      { terms: terms({ policyVersion: 1, printSource: attestedPrintSource("pyth", "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1") }), slot: "open" },
      { terms: terms({}), slot: "open" },
    ]);
    expect(slots.map((s) => `${s.parts.source} v${s.policyVersion}`)).toEqual(["pyth v1", "redstone v2"]);
  });

  it("names each oracle's print by symbol, boundary and version", () => {
    expect(lanePrintCommandId("kraken", "TSLAx", T, 1)).toBe(`lprint:kraken:TSLAx:${T}:v1`);
  });
});

describe("attested reads (C6)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const deps = (over = {}) => ({
    sources: { gateways: ["https://gw.test"], redstoneSigners: new Set(["0xa", "0xb", "0xc", "0xd", "0xe"]), redstoneThreshold: 3 },
    switchboardFeeds: new Map([["TSLAX/USD", "86eaad1d"]]),
    prestocks: () => null,
    ...over,
  });
  const slot = { boundarySec: T, earliestSec: T + 5, deadlineSec: T + 900 };
  const pkg = (signer: string, value: string, tSec = T) => ({ timestampMilliseconds: tSec * 1000, signature: "", signerAddress: signer, dataPoints: [{ dataFeedId: "TSLA", value }] });

  it("RedStone: the median of the configured signers' packages at exactly T, once three have signed", async () => {
    const bodies = [
      JSON.stringify({ TSLA: [pkg("0xA", "251.1"), pkg("0xB", "251.3")] }),
      JSON.stringify({ TSLA: [pkg("0xA", "251.1"), pkg("0xB", "251.3"), pkg("0xC", "251.2"), pkg("0xZ", "999"), pkg("0xD", "250", T - 10)] }),
    ];
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const text = bodies[Math.min(urls.length - 1, 1)]!;
      return { ok: true, status: 200, text: async () => text };
    });
    const reader = createAttestedReader(deps());
    const parts = { source: "redstone" as const, feed: "TSLA" };
    expect(await reader.read(parts, slot, T + 6)).toMatchObject({ kind: "wait", retrySec: T + 10 });
    expect(await reader.read(parts, slot, T + 10)).toMatchObject({ kind: "wait", why: "RedStone TSLA @T has 2 of 3 signers" });
    const ok = await reader.read(parts, slot, T + 16);
    expect(ok).toMatchObject({ kind: "ok", read: { priceE8: 25_120_000_000n, fetchedAtSec: T + 16, signers: 3 } });
    expect(urls[0]).toBe(`https://gw.test/data-packages/historical/redstone-primary-prod/${T * 1000}`);
    expect(await reader.read(parts, { ...slot, deadlineSec: T + 900 }, T + 901)).toMatchObject({ kind: "missed" });
  });

  it("Pyth: without a key the print is missed, never guessed", async () => {
    const reader = createAttestedReader(deps());
    expect(await reader.read({ source: "pyth", feed: "16dad506" }, slot, T + 5)).toEqual({ kind: "missed", why: "PYTH_API_KEY is not set (Hermes answers 401)" });
  });

  it("Switchboard: reads a Surge simulation inside [T + 10, T + 60] and waits out a crossbar error", async () => {
    let body = JSON.stringify([{ feedHash: "86eaad1d", results: null, error: "Service unavailable: IPFS fetch temporarily unavailable" }]);
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, text: async () => body }));
    const reader = createAttestedReader(deps());
    const parts = { source: "switchboard" as const, feed: "TSLAX/USD" };
    expect(await reader.read(parts, { ...slot, earliestSec: T + 10 }, T + 20)).toMatchObject({ kind: "wait", why: "crossbar: Service unavailable: IPFS fetch temporarily unavailable" });
    body = JSON.stringify([{ feedHash: "86eaad1d", results: [251.4] }]);
    expect(await reader.read(parts, { ...slot, earliestSec: T + 10 }, T + 30)).toMatchObject({ kind: "ok", read: { priceE8: 25_140_000_000n } });
    expect(await reader.read(parts, { ...slot, earliestSec: T + 10 }, T + 61)).toMatchObject({ kind: "missed", why: "past T + 60 s" });
    expect(surgeValueOf("[]")).toEqual({ error: "crossbar returned no result" });
  });

  it("PreStocks: the first catalogue read inside [T + 10, T + 45], and missed once that window has closed", async () => {
    const history = [{ symbol: "OPENAI" as const, mint: "m", tokenPriceE8: 90_000_000_000n, markPriceE8: 0n, fetchedAtSec: T + 12 }];
    const reader = createAttestedReader(deps({ prestocks: () => ({ history: () => history, snapshots: () => [] }) }));
    const parts = { source: "prestocks" as const, feed: "OPENAI" };
    const s = { boundarySec: T, earliestSec: T + 10, deadlineSec: T + 900 };
    expect(await reader.read(parts, s, T + 20)).toMatchObject({ kind: "ok", read: { priceE8: 90_000_000_000n, fetchedAtSec: T + 12 } });
    const late = createAttestedReader(deps({ prestocks: () => ({ history: () => [], snapshots: () => [] }) }));
    expect(await late.read(parts, s, T + 30)).toMatchObject({ kind: "wait" });
    expect(await late.read(parts, s, T + 46)).toMatchObject({ kind: "missed" });
  });
});
