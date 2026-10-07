import { afterEach, describe, expect, it, vi } from "vitest";
import { BASKETS, PRE_IPO_TICKERS, primarySourceAt, type PreIpoSymbol, type TickerSymbol } from "@owarine/core/market";
import type { PreStocksSample, PreStocksSnapshot } from "../../prices/prestocks-spot";
import type { SpotFeed, SpotQuote } from "../../prices/spot";
import { pythFeedsToRead } from "./decide";
import { emptySignals, followSpot, loadSourceVersions, prestocksNewest, readAlpaca, readPyth } from "./signals";
import { loadRelaySources } from "../price-relay/sources";

const NOW = Date.parse("2026-09-30T15:00:00Z") / 1000;
afterEach(() => vi.unstubAllGlobals());

describe("loadSourceVersions: the halt table is the bootstrap's", () => {
  const versions = loadSourceVersions();

  it("names each covered asset's dated sources, and no crypto, valuation lane or SPY", () => {
    expect(primarySourceAt(versions.TSLA ?? [], NOW)).toBe("redstone");
    expect(primarySourceAt(versions.QQQ ?? [], NOW)).toBe("alpaca");
    expect(primarySourceAt(versions.TSLAx ?? [], NOW)).toBe("jupiter");
    expect(primarySourceAt(versions.OPENAI ?? [], NOW)).toBe("prestocks");
    expect(primarySourceAt(versions.AILABS ?? [], NOW)).toBe("basket");
    for (const asset of ["BTC", "ETH", "OPENAIV", "SPY"]) expect(Object.keys(versions)).not.toContain(asset);
  });
});

describe("Pyth is read only for a lane whose primary is Pyth", () => {
  const feeds = loadRelaySources().pythFeeds;
  const primaryNow = Object.fromEntries(Object.entries(loadSourceVersions()).map(([asset, v]) => [asset, primarySourceAt(v ?? [], NOW)]));

  it("picks no feed today, so the pass makes no Hermes call", async () => {
    expect(feeds.length).toBeGreaterThan(0);
    expect(pythFeedsToRead(feeds, primaryNow)).toEqual([]);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await readPyth(emptySignals(), pythFeedsToRead(feeds, primaryNow), "a-key");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("picks exactly the feeds of the lanes that do settle on Pyth (before the trial ended)", () => {
    const trial = Object.fromEntries(Object.entries(loadSourceVersions()).map(([asset, v]) => [asset, primarySourceAt(v ?? [], Date.parse("2026-09-20T15:00:00Z") / 1000)]));
    expect(pythFeedsToRead(feeds, trial).map((f) => f.symbol).sort()).toEqual(["QQQ", "TSLA", "VOO"]);
  });
});

describe("followSpot", () => {
  const feed = () => {
    let listener: ((q: SpotQuote) => void) | null = null;
    const spot: SpotFeed = { latest: () => null, subscribe: (l) => ((listener = l), () => (listener = null)) };
    return { spot, emit: (q: SpotQuote) => listener?.(q) };
  };
  const quote = (symbol: SpotQuote["symbol"], source: SpotQuote["source"], publishTimeSec: number): SpotQuote => ({ symbol, priceE8: 1n, publishTimeSec, source });

  it("keeps the newest RedStone package and the newest Alpaca trade per ticker, and ignores Pyth, Jupiter and crypto ticks", () => {
    const book = emptySignals();
    const { spot, emit } = feed();
    followSpot(book, spot);
    emit(quote("TSLA", "redstone", NOW - 30));
    emit(quote("TSLA", "redstone", NOW - 50));
    emit(quote("QQQ", "alpaca", NOW - 12));
    emit(quote("QQQ", "pyth", NOW));
    emit(quote("TSLA", "pyth", NOW));
    emit(quote("TSLAx", "jupiter", NOW));
    emit(quote("BTC", "exchange", NOW));
    expect(book.redstoneNewestSec).toEqual({ TSLA: NOW - 30 });
    expect(book.alpacaNewestSec).toEqual({ QQQ: NOW - 12 });
    expect(book.pyth).toEqual({});
  });
});

describe("readAlpaca (a process without the spot feed)", () => {
  const keys = { keyId: "id", secretKey: "secret", dataUrl: "https://alpaca.test/v2" };
  const trades = (t: string) => JSON.stringify({ trades: { QQQ: { p: 736.81, t }, VOO: { p: 701.5, t } } });

  it("takes the newest IEX trade time of the given tickers, with the keys in headers only", async () => {
    const fetchSpy = vi.fn(async () => new Response(trades("2026-09-30T14:59:50Z")));
    vi.stubGlobal("fetch", fetchSpy);
    const book = emptySignals();
    await readAlpaca(book, ["QQQ", "VOO"], keys);
    expect(book.alpacaNewestSec).toEqual({ QQQ: NOW - 10, VOO: NOW - 10 });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://alpaca.test/v2/stocks/trades/latest?symbols=QQQ,VOO&feed=iex");
    expect(url).not.toContain("secret");
    expect(init.headers).toMatchObject({ "APCA-API-KEY-ID": "id", "APCA-API-SECRET-KEY": "secret" });
  });

  it("keeps the last observation on a failed read, and says why", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    const book = emptySignals();
    book.alpacaNewestSec.QQQ = NOW - 100;
    await readAlpaca(book, ["QQQ"], keys);
    expect(book.alpacaNewestSec).toEqual({ QQQ: NOW - 100 });
    expect(book.problems).toEqual(["alpaca: HTTP 503"]);
  });

  it("reads nothing without keys or without a lane on Alpaca", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const book = emptySignals();
    await readAlpaca(book, ["QQQ"], null);
    await readAlpaca(book, [], keys);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(book.problems).toEqual(["alpaca: no ALPACA_KEY_ID / ALPACA_SECRET_KEY"]);
  });
});

describe("prestocksNewest", () => {
  const sample = (symbol: PreIpoSymbol, fetchedAtSec: number): PreStocksSample => ({ symbol, mint: "m", tokenPriceE8: 100_000_000n, markPriceE8: 1n, fetchedAtSec });
  const read = (fetchedAtSec: number, omit: readonly PreIpoSymbol[] = []): PreStocksSnapshot => ({
    fetchedAtSec,
    samples: new Map((PRE_IPO_TICKERS as readonly PreIpoSymbol[]).filter((s) => !omit.includes(s)).map((s) => [s as TickerSymbol, sample(s, fetchedAtSec)])),
    missing: omit as unknown as TickerSymbol[],
  });

  it("is the newest read that priced each name, and for a basket the newest read that priced every member", () => {
    const newest = prestocksNewest([read(NOW - 100), read(NOW - 40, ["ANTHROPIC"]), read(NOW - 10, ["POLYMARKET"])]);
    expect(newest.OPENAI).toBe(NOW - 10);
    expect(newest.ANTHROPIC).toBe(NOW - 10);
    expect(newest.POLYMARKET).toBe(NOW - 40);
    // AI Labs needs OpenAI and Anthropic: the -40 read lacks Anthropic, the -10 read has both. Prediction Markets needs Kalshi and Polymarket: only -40 has both.
    expect(newest.AILABS).toBe(NOW - 10);
    expect(newest.PREDMKTS).toBe(NOW - 40);
    expect(BASKETS.PREALL.members).toHaveLength(8);
    expect(newest.PREALL).toBe(NOW - 100);
  });

  it("leaves a name that no read priced absent (never read is stale), and an empty feed says nothing", () => {
    expect(prestocksNewest([read(NOW - 5, ["KALSHI"])]).KALSHI).toBeUndefined();
    expect(prestocksNewest([read(NOW - 5, ["KALSHI"])]).PREDMKTS).toBeUndefined();
    expect(prestocksNewest([])).toEqual({});
  });
});
