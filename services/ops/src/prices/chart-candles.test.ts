import { describe, expect, it } from "vitest";
import { aggregate, createChartCandles, parseCoinbaseCandles } from "./chart-candles";

describe("chart candles", () => {
  it("parses Coinbase rows newest-first into ascending [t, o, h, l, c]", () => {
    const text = JSON.stringify([[120, 9, 12, 10, 11, 5], [60, 8, 11, 9, 10, 4]]);
    expect(parseCoinbaseCandles(text)).toEqual([[60_000, 9, 11, 8, 10], [120_000, 10, 12, 9, 11]]);
  });
  it("aggregates finer candles into aligned buckets", () => {
    const rows: Array<[number, number, number, number, number]> = [[0, 1, 2, 0.5, 1.5], [60_000, 1.5, 3, 1, 2], [120_000, 2, 2.5, 1.8, 2.2], [180_000, 2.2, 2.4, 2, 2.1]];
    expect(aggregate(rows, 180)).toEqual([[0, 1, 3, 0.5, 2.2], [180_000, 2.2, 2.4, 2, 2.1]]);
  });
  it("refuses unknown intervals and non-crypto symbols", async () => {
    const read = createChartCandles(async () => new Response("[]"));
    expect((await read({ symbol: "BTC", interval: "7m" })).status).toBe(400);
    expect((await read({ symbol: "TSLA", interval: "1m" })).status).toBe(404);
  });
  it("pages Coinbase for an aggregated interval", async () => {
    const urls: string[] = [];
    const read = createChartCandles(async (url) => {
      urls.push(String(url));
      const end = Math.floor(Date.parse(new URL(String(url)).searchParams.get("end")!) / 1000);
      return new Response(JSON.stringify(Array.from({ length: 300 }, (_, i) => [end - (i + 1) * 60, 1, 2, 1, 1.5, 1])));
    });
    const r = await read({ symbol: "BTC", interval: "3m", count: 150, endMs: 1_791_000_000_000 });
    expect(r.status).toBe(200);
    expect(urls.length).toBe(2);
    expect((r.body as { candles: unknown[] }).candles.length).toBeGreaterThanOrEqual(149);
  });
});
