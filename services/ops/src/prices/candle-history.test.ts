import { describe, expect, it } from "vitest";
import { fetchCloseHistory, parseBitstampHistory, parseCoinbaseHistory, parseKrakenHistory } from "./candle-history";
import { measureSymbol } from "./vol-meter";
import type { Fetch } from "./candles";

describe("candle history (C6 vol re-measure)", () => {
  it("reads each exchange's range response, dropping Kraken's still-forming bar", () => {
    expect(parseCoinbaseHistory("[[120,1,2,1.5,101.5,3],[60,1,2,1.5,101,3]]")).toEqual([{ sec: 120, price: 101.5 }, { sec: 60, price: 101 }]);
    const kraken = JSON.stringify({ error: [], result: { XXBTZUSD: [[60, "1", "2", "0.5", "100.1", "1", "1", 3], [120, "1", "2", "0.5", "100.2", "1", "1", 3], [180, "1", "2", "0.5", "100.3", "1", "1", 3]], last: 120 } });
    expect(parseKrakenHistory(kraken)).toEqual([{ sec: 60, price: 100.1 }, { sec: 120, price: 100.2 }]);
    expect(() => parseKrakenHistory(JSON.stringify({ error: ["EGeneral:Too many requests"] }))).toThrow(/Too many/);
    expect(parseBitstampHistory(JSON.stringify({ data: { ohlc: [{ ["timestamp"]: "60", close: "99.5" }] } }))).toEqual([{ sec: 60, price: 99.5 }]);
  });

  it("pages Coinbase by 300 bars and keeps only the asked range, sorted and unique", async () => {
    const urls: string[] = [];
    const fetchImpl: Fetch = async (url) => {
      urls.push(url);
      const start = Date.parse(new URL(url).searchParams.get("start")!) / 1000;
      const end = Date.parse(new URL(url).searchParams.get("end")!) / 1000;
      const rows: number[][] = [];
      for (let t = end; t >= start; t -= 60) rows.push([t, 1, 2, 1, 100 + t / 60, 1]);
      return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    };
    const closes = await fetchCloseHistory("coinbase", "BTC", 0, 400 * 60, fetchImpl);
    expect(urls).toHaveLength(2);
    expect(closes).toHaveLength(400);
    expect(closes[0]!.sec).toBe(0);
    expect(closes.at(-1)!.sec).toBe(399 * 60);
  });

  it("measures the median across exchanges and reports one that failed", async () => {
    const zig = (from: number, n: number, step: number) => Array.from({ length: n }, (_, i) => ({ t: from + i * 60, p: 100 * (i % 2 ? 1 + step : 1) }));
    const fetchImpl: Fetch = async (url) => {
      const u = new URL(url);
      if (u.hostname.includes("kraken")) return { ok: false, status: 503, text: async () => "down" };
      if (u.hostname.includes("coinbase")) {
        const start = Date.parse(u.searchParams.get("start")!) / 1000;
        const end = Date.parse(u.searchParams.get("end")!) / 1000;
        return { ok: true, status: 200, text: async () => JSON.stringify(zig(start, (end - start) / 60 + 1, 0.001).map((r) => [r.t, 0, 0, 0, r.p, 0])) };
      }
      const end = Number(u.searchParams.get("end"));
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: { ohlc: zig(end - 999 * 60, 1_000, 0.002).map((r) => ({ ["timestamp"]: String(r.t), close: String(r.p) })) } }) };
    };
    const r = await measureSymbol("BTC", 600, 1_790_640_000, fetchImpl);
    if ("error" in r) throw new Error(r.error);
    expect(r.perExchange.kraken).toEqual({ error: "kraken BTC HTTP 503" });
    const cb = (r.perExchange.coinbase as { sigmaBps: number }).sigmaBps;
    const bs = (r.perExchange.bitstamp as { sigmaBps: number }).sigmaBps;
    expect(bs).toBeGreaterThan(cb);
    expect(r.sigmaBps).toBe(Math.round((cb + bs) / 2));
  });
});
