/**
 * C4c: a local run (`scripts/drive/ops-local.ts`) quotes stocks when the Alpaca keys are set, from the same feeds
 * `main.ts` joins, and stays crypto only (saying so) without them. No crypto stand-in for a stock.
 */
import { describe, expect, it, vi } from "vitest";
import type { PreStocksSpotHandle } from "./prestocks-spot";
import type { SpotQuote } from "./spot";
import { createLocalSpot, type LocalSpotMakers } from "./local-spot";

const NOW = Math.floor(Date.now() / 1000);
const quote = (symbol: string, source: SpotQuote["source"]): SpotQuote => ({ symbol, priceE8: 100n, publishTimeSec: NOW, source }) as SpotQuote;

function fakes() {
  const started: string[] = [];
  const feed = (name: string, answers: Record<string, SpotQuote>) => ({
    latest: (symbol: string) => answers[symbol] ?? null,
    subscribe: () => () => undefined,
    start: () => void started.push(name),
    stop: vi.fn(),
  });
  const equity = vi.fn((_alpaca: { keyId: string; secretKey: string }) => feed("equity", { AAPL: quote("AAPL", "redstone"), QQQ: quote("QQQ", "alpaca") }));
  const make: LocalSpotMakers = {
    crypto: () => feed("crypto", { BTC: quote("BTC", "exchange") }),
    equity: (alpaca) => equity(alpaca),
    prestocks: () =>
      ({
        ...feed("prestocks", {}),
        latest: (symbol: string) => (symbol === "OPENAI" ? { symbol: "OPENAI", mint: "m", tokenPriceE8: 5n, markPriceE8: 4n, fetchedAtSec: NOW } : null),
        at: () => null, history: () => [], snapshots: () => [], symbols: () => ["OPENAI"], subscribeSnapshots: () => () => undefined,
      }) as unknown as PreStocksSpotHandle,
  };
  return { make, started, equity };
}

describe("createLocalSpot (C4c)", () => {
  it("with the Alpaca keys: crypto, equity and PreStocks, joined as main.ts joins them", () => {
    const f = fakes();
    const local = createLocalSpot({ log: () => () => undefined, env: { ALPACA_KEY_ID: "id", ALPACA_SECRET_KEY: "secret" }, make: f.make });
    expect(local.stocks).toBe(true);
    expect(f.started).toEqual(["crypto", "equity", "prestocks"]);
    expect(f.equity).toHaveBeenCalledWith({ keyId: "id", secretKey: "secret" });
    expect(local.spot.latest("AAPL")).toMatchObject({ symbol: "AAPL", source: "redstone" });
    expect(local.spot.latest("QQQ")).toMatchObject({ source: "alpaca" });
    expect(local.spot.latest("OPENAI")).toMatchObject({ symbol: "OPENAI", priceE8: 5n, source: "prestocks" });
    expect(local.spot.latest("BTC")).toMatchObject({ source: "exchange" });
    expect(local.prestocks).not.toBeNull();
  });

  it("without them: crypto only, no stock quote from any other source, and a summary that says why", () => {
    const f = fakes();
    const local = createLocalSpot({ log: () => () => undefined, env: {}, make: f.make });
    expect(local.stocks).toBe(false);
    expect(f.started).toEqual(["crypto"]);
    expect(f.equity).not.toHaveBeenCalled();
    expect(local.spot.latest("AAPL")).toBeNull();
    expect(local.spot.latest("BTC")).toMatchObject({ source: "exchange" });
    expect(local.summary).toContain("ALPACA_KEY_ID");
    expect(local.prestocks).toBeNull();
  });
});
