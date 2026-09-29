import { describe, expect, it } from "vitest";
import { CALENDAR_YEAR_SEC } from "@agari/core/market";
import { readSeatMakerEnv } from "./env";
import { fairYesTicks, TRADING_YEAR_SEC } from "./fair";
import { sigmaFor } from "./pricer";

const vol = (m: Record<string, number>) => ({ sigmaBps: (s: string) => m[s] ?? null, readings: () => [] });

describe("pricer σ (C6)", () => {
  it("never prices crypto on the placeholder: measured σ on the 365-day clock, or wait", () => {
    const maker = readSeatMakerEnv({});
    expect(sigmaFor(maker, null, "BTC")).toEqual({ missing: "BTC realised vol not measured yet" });
    expect(sigmaFor(maker, vol({ BTC: 3_709 }), "BTC")).toEqual({ sigmaBps: 3_709, yearSec: CALENDAR_YEAR_SEC });
    expect(sigmaFor(maker, vol({ BTC: 3_709 }), "ETH")).toEqual({ missing: "ETH realised vol not measured yet" });
  });

  it("an MM_SIGMA_BPS override still wins for crypto, and equities keep their table on the session clock", () => {
    const maker = readSeatMakerEnv({ MM_SIGMA_BPS: "BTC:5000" });
    expect(sigmaFor(maker, vol({ BTC: 3_709 }), "BTC")).toEqual({ sigmaBps: 5_000, yearSec: CALENDAR_YEAR_SEC });
    expect(sigmaFor(maker, null, "TSLA")).toEqual({ sigmaBps: 4_500 });
  });

  it("a crypto move prices more decisively on the measured σ and 24/7 clock: the placeholder overstated per-second variance", () => {
    const base = { spotE8: 100_100_000_000n, openE8: 100_000_000_000n, secondsLeft: 240, minTick: 20 };
    const measured = fairYesTicks({ ...base, sigmaBps: 3_709, yearSec: CALENDAR_YEAR_SEC });
    const placeholder = fairYesTicks({ ...base, sigmaBps: 6_000, yearSec: TRADING_YEAR_SEC });
    expect(measured).toBeGreaterThan(placeholder);
    expect(measured).toBeGreaterThan(501);
  });
});
