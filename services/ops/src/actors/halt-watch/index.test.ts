import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRE_IPO_TICKERS, TICKERS, type TickerSymbol } from "@owarine/core/market";
import type { PreStocksRead } from "@owarine/markets/ops/prints";
import { createPreStocksSpotFeed, type PreStocksSpotHandle } from "../../prices/prestocks-spot";
import type { SpotFeed, SpotQuote } from "../../prices/spot";
import type { VenueDeps } from "../../runtime";
import { createHaltBoard } from "../../runtime/halt-board";
import { recordQuoteResult, resetQuoteStreaks } from "./quote-failures";
import { startHaltWatch } from "./index";

/**
 * The whole pass over the process's real halt board, with the network stubbed: what a running halt-watch decides on the
 * Canton lane sources (C6f). Wednesday 2026-09-30 11:00 ET, regular hours, after the Pyth trial and after QQQ, VOO and
 * the xStocks moved to Alpaca and Jupiter.
 */
const START = new Date("2026-09-30T15:00:00Z");
const startSec = START.getTime() / 1000;
const RED_STONE = ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL"] as const;

const calls: string[] = [];
const fetchStub = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  calls.push(url);
  const xstock = /system\/status\/(\w+)$/.exec(url)?.[1];
  return xstock ? new Response(JSON.stringify({ symbol: xstock, isMarketTradingHalted: false })) : new Response("{}", { status: 500 });
});

function harness() {
  let listener: ((q: SpotQuote) => void) | null = null;
  const spot: SpotFeed = { latest: () => null, subscribe: (l) => ((listener = l), () => (listener = null)) };
  const halts = createHaltBoard();
  const deps = {
    log: () => {},
    sessions: { refresh: async () => "calendar fresh", status: () => ({ state: "regular" }), calendar: () => null, disagreements: () => [] },
    spot,
    halts,
  } as unknown as VenueDeps;
  const emit = (symbol: SpotQuote["symbol"], source: SpotQuote["source"], atSec: number) => listener?.({ symbol, priceE8: 1n, publishTimeSec: atSec, source });
  const reasons = () => Object.fromEntries(Object.entries(halts.board()).map(([asset, entry]) => [asset, entry!.reason]));
  return { deps, emit, reasons };
}

/** Runs the actor `sec` seconds, one 5 s tick at a time; `tick` emits what the spot feed's polls would have. */
async function run(sec: number, tick: () => void) {
  for (let t = 0; t < sec; t += 5) {
    tick();
    await vi.advanceTimersByTimeAsync(5_000);
  }
}
const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  // A Pyth key is set, so a Hermes read would go out if halt-watch wanted one.
  vi.stubEnv("PYTH_API_KEY", "a-pyth-key");
  vi.stubGlobal("fetch", fetchStub);
  calls.length = 0;
  fetchStub.mockClear();
  resetQuoteStreaks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("halt-watch on the Canton lane sources", () => {
  it("halts QQQ on a stale Alpaca trade and TSLA on a stale RedStone package, never on a Pyth tick, and makes no Pyth call", async () => {
    const h = harness();
    const watch = await startHaltWatch(h.deps);
    try {
      await run(45, () => {
        // Everything fresh but TSLA's RedStone package (never newer than 100 s before the start) and QQQ's last IEX trade (200 s).
        for (const s of RED_STONE) if (s !== "TSLA") h.emit(s, "redstone", nowSec() - 4);
        h.emit("TSLA", "redstone", startSec - 100);
        h.emit("VOO", "alpaca", nowSec() - 9);
        h.emit("QQQ", "alpaca", startSec - 200);
        // Fresh Pyth ticks for the two: a lane on RedStone or Alpaca is not judged on them.
        h.emit("TSLA", "pyth", nowSec());
        h.emit("QQQ", "pyth", nowSec());
      });
      expect(h.reasons()).toEqual({ TSLA: "redstone-stale", QQQ: "alpaca-stale" });
      expect(calls.filter((url) => url.includes("pyth"))).toEqual([]);
      // The issuer flags are still read (keyless), and nothing else reaches out: the quotes come from the spot feed.
      expect(calls.every((url) => url.includes("api.xstocks.fi"))).toBe(true);
    } finally {
      watch.stop();
    }
  });

  it("clears a stale-source halt two passes after the source is fresh again", async () => {
    const h = harness();
    const watch = await startHaltWatch(h.deps);
    try {
      let qqqAlive = false;
      const tick = () => {
        for (const s of RED_STONE) h.emit(s, "redstone", nowSec() - 4);
        h.emit("VOO", "alpaca", nowSec() - 9);
        h.emit("QQQ", "alpaca", qqqAlive ? nowSec() - 3 : startSec - 200);
      };
      await run(45, tick);
      expect(h.reasons()).toEqual({ QQQ: "alpaca-stale" });
      qqqAlive = true;
      await run(15, tick);
      expect(h.reasons()).toEqual({});
    } finally {
      watch.stop();
    }
  });

  it("halts an xStock on three failed Jupiter quotes, and a healthy stack halts nothing", async () => {
    const h = harness();
    const watch = await startHaltWatch(h.deps);
    try {
      const healthy = () => {
        for (const s of RED_STONE) h.emit(s, "redstone", nowSec() - 4);
        for (const s of ["QQQ", "VOO"] as const) h.emit(s, "alpaca", nowSec() - 9);
      };
      await run(60, healthy);
      expect(h.reasons()).toEqual({});
      recordQuoteResult(["TSLAx"], false);
      recordQuoteResult(["TSLAx"], false);
      await run(10, healthy);
      expect(h.reasons()).toEqual({});
      recordQuoteResult(["TSLAx"], false);
      await run(15, healthy);
      expect(h.reasons()).toEqual({ TSLAx: "quote-unavailable" });
    } finally {
      watch.stop();
    }
  });
});

describe("halt-watch on the PreStocks lanes", () => {
  const catalogue = (): PreStocksRead => ({
    tokens: new Map(PRE_IPO_TICKERS.map((s) => [s, { symbol: s, name: s, mint: String(TICKERS[s].preIpo!.mint), tokenPriceE8: 100_000_000n, markPriceE8: 100_000_000n }])),
    fetchedAtSec: nowSec(),
    ageSec: null,
  });

  it("halts the names and baskets when the catalogue stops answering, at any hour, and clears them when it answers again", async () => {
    let answering = true;
    const feed: PreStocksSpotHandle = createPreStocksSpotFeed({
      log: () => {},
      bootSpreadMs: 0,
      read: async () => {
        if (!answering) throw new Error("PreStocks catalogue: HTTP 429");
        return catalogue();
      },
    });
    feed.start();
    const h = harness();
    const watch = await startHaltWatch(h.deps);
    const healthy = () => {
      for (const s of RED_STONE) h.emit(s, "redstone", nowSec() - 4);
      for (const s of ["QQQ", "VOO"] as const) h.emit(s, "alpaca", nowSec() - 9);
    };
    try {
      await run(60, healthy);
      expect(h.reasons()).toEqual({});
      answering = false;
      // The last read was ≤ 10 s ago; the host backs off 30 s and then longer, so the newest read passes 60 s and holds.
      await run(150, healthy);
      const halted = h.reasons();
      expect(Object.keys(halted).sort()).toEqual([...PRE_IPO_TICKERS, "AILABS", "DEFSPACE", "FRONTIER", "PREALL", "PREDMKTS"].sort() as TickerSymbol[]);
      expect(new Set(Object.values(halted))).toEqual(new Set(["prestocks-stale"]));
      answering = true;
      await run(320, healthy);
      expect(h.reasons()).toEqual({});
    } finally {
      watch.stop();
      feed.stop();
    }
  });
});
