import { describe, expect, it } from "vitest";
import { laneKey, parseLaneKey } from "./tickers";
import { tokenWindows } from "./windows";

describe("staggered Series", () => {
  it("names and parses a phase in whole minutes", () => {
    expect(laneKey("BTC", "token", 120, 60)).toBe("BTC-2m_1");
    expect(laneKey("BTC", "token", 120)).toBe("BTC-2m");
    expect(parseLaneKey("BTC-2m_1")).toEqual({ symbol: "BTC", basis: "token", cadenceSec: 120, phaseSec: 60 });
    expect(parseLaneKey("BTC-5m_3")).toMatchObject({ cadenceSec: 300, phaseSec: 180 });
    expect(parseLaneKey("BTC-5m")).toEqual({ symbol: "BTC", basis: "token", cadenceSec: 300 });
    expect(parseLaneKey("BTC-2m_2")).toBeNull();
  });
  it("lays a phased lane's Windows a phase off the cadence grid", () => {
    const T = 1_790_000_040; // a whole minute, odd
    const even = tokenWindows(T - 60, T + 300, 120).map((w) => w.tradingStartSec);
    const odd = tokenWindows(T - 60, T + 300, 120, 60).map((w) => w.tradingStartSec);
    expect(even.every((s) => s % 120 === 0)).toBe(true);
    expect(odd.every((s) => s % 120 === 60)).toBe(true);
    expect(() => tokenWindows(T, T + 600, 120, 30)).toThrow();
  });
});
