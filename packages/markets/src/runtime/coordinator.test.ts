import { afterEach, expect, it, vi } from "vitest";
import type { BookTarget } from "@owarine/core/ports";
import { ladderSnapshot, resetCoordinator, subscribeBook } from "./coordinator";

const wire = (marketId: string) => ({ marketId, damlMarketId: "BTC-2m:1", seriesId: "s", termsCid: "t", seriesKey: "BTC-2m", symbol: "BTC", index: 1, tradingStartSec: 10, lockAtSec: 150, expirySec: 150, quotingUntilSec: 140, cashUnit: "1000", feeRateBps: 100, fairTicks: 500, up: [[530, "100"]], down: [[530, "100"]], asOfMs: 10_000, state: "quoting" });
const stream = vi.hoisted(() => ({ error: null as null | ((closed: boolean) => void), ladder: null as null | ((data: string) => void) }));
vi.mock("./read-runtime", () => ({ peekClient: () => ({ ladderUrl: "https://ops.example" }), subscribeExchange: () => () => undefined }));
vi.mock("./event-source", () => ({ openStream: () => ({ listen: (_event: string, f: (data: string) => void) => { stream.ladder = f; }, onError: (f: (closed: boolean) => void) => { stream.error = f; }, close: () => undefined }) }));
vi.mock("./accounts", () => ({ peekSeries: () => null, readSeries: () => new Promise(() => undefined), readVenueStatic: async () => ({ decimals: 6 }) }));

afterEach(() => { resetCoordinator(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("refreshes missing position ladders while EventSource is still allocated and reconnecting", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ladders: [wire("first")], asOfMs: 10_000 }) })
    .mockResolvedValue({ ok: true, json: async () => ({ ladders: [wire("held")], asOfMs: 12_000 }) });
  vi.stubGlobal("fetch", fetch);
  const off = subscribeBook({ marketId: "held", poolAddress: "held", decimals: 6 } as BookTarget, () => undefined);
  await vi.advanceTimersByTimeAsync(0);
  expect(ladderSnapshot("held")).toBeNull();
  stream.error!(false); // EventSource retries on its own; its object remains allocated.
  await vi.advanceTimersByTimeAsync(2_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(ladderSnapshot("held")?.ladder.marketId).toBe("held");
  expect(ladderSnapshot("held")?.live).toBe(false); // A last-known quote is still labelled as such.
  off();
});

it("does not overlap slow snapshot refreshes", async () => {
  vi.useFakeTimers();
  let resolve!: (value: unknown) => void;
  const fetch = vi.fn(() => new Promise((r) => { resolve = r; }));
  vi.stubGlobal("fetch", fetch);
  const off = subscribeBook({ marketId: "held", poolAddress: "held", decimals: 6 } as BookTarget, () => undefined);
  await vi.advanceTimersByTimeAsync(6_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  resolve({ ok: true, json: async () => ({ ladders: [wire("held")], asOfMs: 12_000 }) });
  await vi.advanceTimersByTimeAsync(0);
  expect(ladderSnapshot("held")).not.toBeNull();
  off();
});

it("does not overwrite a newer stream price with a slow fallback response or poll a healthy stream", async () => {
  vi.useFakeTimers();
  let resolve!: (value: unknown) => void;
  const fetch = vi.fn(() => new Promise((r) => { resolve = r; }));
  vi.stubGlobal("fetch", fetch);
  const off = subscribeBook({ marketId: "held", poolAddress: "held", decimals: 6 } as BookTarget, () => undefined);
  stream.ladder!(JSON.stringify({ ...wire("held"), asOfMs: 20_000, fairTicks: 600 }));
  resolve({ ok: true, json: async () => ({ ladders: [wire("held")], asOfMs: 10_000 }) });
  await vi.advanceTimersByTimeAsync(4_000);
  expect(ladderSnapshot("held")?.ladder.fairTicks).toBe(600);
  expect(ladderSnapshot("held")?.live).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  off();
});
