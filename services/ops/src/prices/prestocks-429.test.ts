/**
 * C4c: PreStocks answered 429 to this host at boot, and the pre-IPO and basket lanes read "paused" (C6, C6e, C9d). The
 * feed now spreads its first read, honours `Retry-After`, and otherwise backs off with jitter, as the reference's
 * fetchers do. Here against a fake catalogue that rate-limits its first two reads: the real `fetchPreStocks`, the real
 * feed loop, only the clock injected.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { PRE_IPO_TICKERS, TICKERS } from "@agari/core/market";
import { fetchPreStocks, PreStocksHttpError, retryAfterMsOf } from "@agari/markets/ops/prints";
import { createPreStocksSpotFeed } from "./prestocks-spot";

/** A catalogue row for every registry pre-IPO name, priced from its source text as PreStocks sends it. */
const CATALOGUE = JSON.stringify(
  PRE_IPO_TICKERS.map((symbol, i) => ({ symbol, name: symbol, contract_address: String(TICKERS[symbol].preIpo!.mint), markPrice: 100 + i, tokenPrice: 110.5 + i })),
);

let server: Server | null = null;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

/** Answers `limited` with 429 (the first with `Retry-After: 2`), then the catalogue. */
async function fakeCatalogue(limited: number): Promise<{ url: string; hits: () => number }> {
  let hits = 0;
  server = createServer((_req, res) => {
    hits += 1;
    if (hits <= limited) {
      res.writeHead(429, hits === 1 ? { "retry-after": "2" } : {});
      return res.end("slow down");
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(CATALOGUE);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/prestocks`, hits: () => hits };
}

describe("PreStocks behind a rate limit (C4c)", () => {
  it("a 429 surfaces with the server's Retry-After, in seconds or as a date", async () => {
    const fake = await fakeCatalogue(1);
    const error = await fetchPreStocks({ url: fake.url }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PreStocksHttpError);
    expect(error).toMatchObject({ status: 429, retryAfterMs: 2_000 });
    expect(retryAfterMsOf("120")).toBe(120_000);
    expect(retryAfterMsOf(new Date(1_000_000 + 30_000).toUTCString(), 1_000_000)).toBe(30_000);
    expect(retryAfterMsOf("soon")).toBeNull();
    expect(retryAfterMsOf(null)).toBeNull();
  });

  it("spreads its first read, waits what Retry-After asked, backs off with jitter after a bare 429, then prices every name", async () => {
    const fake = await fakeCatalogue(2);
    const sleeps: number[] = [];
    const logs: string[] = [];
    let feed: ReturnType<typeof createPreStocksSpotFeed> | null = null;
    let done!: () => void;
    const priced = new Promise<void>((resolve) => (done = resolve));
    feed = createPreStocksSpotFeed({
      log: (why) => logs.push(why),
      read: () => fetchPreStocks({ url: fake.url }),
      bootSpreadMs: 10_000,
      random: () => 0.5,
      // The clock, injected: record each wait and move on at once; stop after the first good read.
      sleep: async (ms) => {
        sleeps.push(ms);
        if (sleeps.length >= 4) {
          feed?.stop();
          done();
        }
      },
    });
    feed.start();
    await priced;
    expect(fake.hits()).toBe(3);
    const [boot, afterRetryAfter, afterBare, afterGood] = sleeps;
    expect(boot).toBe(5_000);
    // Each later wait is the delay less the read's own time, so it is at most the delay and within a second of it.
    expect(afterRetryAfter).toBeLessThanOrEqual(2_000);
    expect(afterRetryAfter).toBeGreaterThan(1_000);
    expect(afterBare).toBeLessThanOrEqual(45_000);
    expect(afterBare).toBeGreaterThan(44_000);
    expect(afterGood).toBeLessThanOrEqual(10_000);
    for (const symbol of PRE_IPO_TICKERS) expect(feed.latest(symbol)).not.toBeNull();
    // One line for the failing streak, naming the wait the server asked for.
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("429");
    expect(logs[0]).toContain("Retry-After");
  });
});
