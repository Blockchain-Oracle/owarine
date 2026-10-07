import { describe, expect, it } from "vitest";
import { parseAlpacaBars, parseAlpacaSnapshots } from "./alpaca-bars";
import { createChartCandles } from "./chart-candles";

const KEYS = { keyId: "k", secretKey: "s" };

describe("alpaca bars", () => {
  it("returns newest-first bars oldest first as [tMs, o, h, l, c]", () => {
    const text = JSON.stringify({ bars: [{ t: "2026-10-07T14:31:00Z", o: 2, h: 3, l: 1.5, c: 2.5 }, { t: "2026-10-07T14:30:00Z", o: 1, h: 2, l: 0.5, c: 2 }], next_page_token: null });
    expect(parseAlpacaBars(text)).toEqual([[Date.parse("2026-10-07T14:30:00Z"), 1, 2, 0.5, 2], [Date.parse("2026-10-07T14:31:00Z"), 2, 3, 1.5, 2.5]]);
    expect(parseAlpacaBars(JSON.stringify({ bars: null }))).toEqual([]);
    expect(() => parseAlpacaBars(JSON.stringify({ message: "forbidden" }))).toThrow(/forbidden/);
  });

  it("quotes a stock's day against the previous close", () => {
    const text = JSON.stringify({ TSLA: { dailyBar: { o: 250, h: 262.5, l: 248, c: 260, v: 1200 }, prevDailyBar: { c: 240 } }, NVDA: null });
    const day = parseAlpacaSnapshots(text, ["TSLA", "NVDA"]);
    expect(day.TSLA).toEqual({ openE8: "24000000000", highE8: "26250000000", lowE8: "24800000000", volume: "1200" });
    expect(day.NVDA).toBeUndefined();
  });

  it("routes stocks to Alpaca's native timeframe only when ops holds keys", async () => {
    const urls: string[] = [];
    const read = createChartCandles(async (url) => (urls.push(String(url)), new Response(JSON.stringify({ bars: [{ t: "2026-10-07T14:30:00Z", o: 1, h: 2, l: 0.5, c: 2 }] }))), KEYS);
    const r = await read({ symbol: "TSLA", interval: "4h", count: 50, endMs: 1_791_000_000_000 });
    expect(r.status).toBe(200);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/\/stocks\/TSLA\/bars\?timeframe=4Hour&.*limit=50&sort=desc&feed=iex/);
    expect((await createChartCandles(async () => new Response("{}"))({ symbol: "TSLA", interval: "1m" })).status).toBe(404);
    expect((await read({ symbol: "OPENAI", interval: "1m" })).status).toBe(404);
  });
});
