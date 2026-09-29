import { describe, expect, it } from "vitest";
import { CALENDAR_YEAR_SEC } from "./crypto";
import { logReturns, medianSigmaBps, realisedVol } from "./realised-vol";

/** A deterministic ±r zig-zag: every log return is exactly ±ln(1 + r) apart, so σ is known in closed form. */
function zigzag(n: number, stepBps: number, barSec = 60, startSec = 1_790_640_000) {
  const up = 1 + stepBps / 10_000;
  return Array.from({ length: n }, (_, i) => ({ sec: startSec + i * barSec, price: 100 * (i % 2 ? up : 1) }));
}

describe("realised volatility (C6)", () => {
  it("annualises the per-bar σ of log returns over the calendar year", () => {
    const closes = zigzag(1_441, 10); // 1,440 returns of ±ln(1.001)
    const v = realisedVol(closes, 60, CALENDAR_YEAR_SEC)!;
    const r = Math.log(1.001);
    // Sample σ of ±r alternating (mean 0 for an even count): r·√(n/(n−1)).
    const expected = r * Math.sqrt(1_440 / 1_439) * Math.sqrt(CALENDAR_YEAR_SEC / 60);
    expect(v.returns).toBe(1_440);
    expect(v.sigmaBps).toBe(Math.round(expected * 10_000));
    expect(v.sigmaBps).toBeGreaterThan(7_200);
    expect(v.sigmaBps).toBeLessThan(7_300);
  });

  it("the equity-hours clock would read the same bars about 2.3 times lower per second, which is what the re-measure fixes", () => {
    const closes = zigzag(601, 10);
    const calendar = realisedVol(closes, 60, CALENDAR_YEAR_SEC)!.sigmaBps;
    const equity = realisedVol(closes, 60, 252 * 23_400)!.sigmaBps;
    expect(calendar / equity).toBeCloseTo(Math.sqrt(CALENDAR_YEAR_SEC / (252 * 23_400)), 2);
  });

  it("never bridges a missing bar with a return, drops non-positive closes and sorts", () => {
    const closes = [
      { sec: 180, price: 103 },
      { sec: 0, price: 100 },
      { sec: 60, price: 101 },
      { sec: 300, price: 0 },
      { sec: 240, price: 104 },
    ];
    expect(logReturns(closes, 60).map((x) => Number(x.toFixed(6)))).toEqual([Number(Math.log(101 / 100).toFixed(6)), Number(Math.log(104 / 103).toFixed(6))]);
  });

  it("refuses to guess from too few returns", () => {
    expect(realisedVol(zigzag(100, 10), 60, CALENDAR_YEAR_SEC)).toBeNull();
    expect(realisedVol(zigzag(100, 10), 60, CALENDAR_YEAR_SEC, 50)).not.toBeNull();
  });

  it("takes the median of the exchanges and ignores a source that measured nothing", () => {
    expect(medianSigmaBps([4_100, null, 3_900, 4_400])).toBe(4_100);
    expect(medianSigmaBps([4_100, 3_900])).toBe(4_000);
    expect(medianSigmaBps([null])).toBeNull();
  });
});
