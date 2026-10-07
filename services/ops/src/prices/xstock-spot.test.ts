import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUOTE_FAILURES_TO_HALT, TICKERS } from "@owarine/core/market";
import { quoteFailureStreak, resetQuoteStreaks } from "../actors/halt-watch/quote-failures";
import { createXStockSpotFeed } from "./xstock-spot";

/** C6f: every 5 s Jupiter poll tells halt-watch which xStocks it priced and which it did not (the token lane's `quote-unavailable`). */
const mint = (symbol: "TSLA" | "NVDA" | "SPY" | "QQQ") => String(TICKERS[symbol].xstock!.mint);
const body = (mints: string[]) => JSON.stringify(Object.fromEntries(mints.map((m) => [m, { usdPrice: 350.25, blockId: 1 }])));
const ALL = [mint("TSLA"), mint("NVDA"), mint("SPY"), mint("QQQ")];

let answer: () => Response;
beforeEach(() => {
  vi.useFakeTimers();
  resetQuoteStreaks();
  vi.stubGlobal("fetch", vi.fn(async () => answer()));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function polls(n: number) {
  const feed = createXStockSpotFeed({ log: () => {} });
  feed.start();
  await vi.advanceTimersByTimeAsync(5_000 * (n - 1));
  feed.stop();
  return feed;
}

describe("xstock-spot reports its quotes to halt-watch", () => {
  it("counts a poll that Jupiter did not price an xStock in, and clears it on the next that does", async () => {
    answer = () => new Response(body(ALL.filter((m) => m !== mint("SPY"))));
    await polls(QUOTE_FAILURES_TO_HALT);
    expect(quoteFailureStreak("SPYx")).toBe(QUOTE_FAILURES_TO_HALT);
    expect(quoteFailureStreak("TSLAx")).toBe(0);
    answer = () => new Response(body(ALL));
    await polls(1);
    expect(quoteFailureStreak("SPYx")).toBe(0);
  });

  it("counts a failed call against every xStock", async () => {
    answer = () => new Response("nope", { status: 429 });
    await polls(2);
    for (const x of ["TSLAx", "NVDAx", "SPYx", "QQQx"] as const) expect(quoteFailureStreak(x)).toBe(2);
    answer = () => new Response(body(ALL));
    await polls(1);
    for (const x of ["TSLAx", "NVDAx", "SPYx", "QQQx"] as const) expect(quoteFailureStreak(x)).toBe(0);
  });
});
