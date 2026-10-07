import { describe, expect, it } from "vitest";
import { approach, cssNumber, easeRange, formatPrice, lowerBound, niceTicks, stepDecimals, targetRange, timeWindow, winning, xOf, yOf } from "./engine";

describe("chart engine", () => {
  it("places now at 80% of the width", () => {
    const w = timeWindow(100_000, 60_000);
    const plot = { x0: 0, x1: 1000, y0: 0, y1: 100 };
    expect(xOf(100_000, { ...w, lo: 0, hi: 1 }, plot)).toBeCloseTo(800);
  });
  it("maps price to y with high at the top", () => {
    const v = { t0: 0, t1: 1, lo: 100, hi: 200 };
    const plot = { x0: 0, x1: 10, y0: 0, y1: 100 };
    expect(yOf(200, v, plot)).toBe(0);
    expect(yOf(100, v, plot)).toBe(100);
  });
  it("binary-searches ascending times", () => {
    expect(lowerBound([1, 3, 5, 7], 4)).toBe(2);
    expect(lowerBound([1, 3, 5, 7], 0)).toBe(0);
    expect(lowerBound([1, 3, 5, 7], 9)).toBe(4);
  });
  it("targets the visible extent, padded, never thinner than the floor", () => {
    const r = targetRange({ t: [0, 10, 20], p: [100, 110, 105], t0: 5, head: 106, padFrac: 0.1 });
    expect(r.lo).toBeCloseTo(99);
    expect(r.hi).toBeCloseTo(111);
    const flat = targetRange({ t: [0], p: [83_000], t0: 0, head: 83_000, minSpanFrac: 0.0002, padFrac: 0 });
    expect(flat.hi - flat.lo).toBeCloseTo(16.6);
  });
  it("keeps pinned prices (the open print) in range", () => {
    const r = targetRange({ t: [0], p: [100], t0: 0, head: 100, pinned: [90, null], padFrac: 0 });
    expect(r.lo).toBe(90);
  });
  it("eases toward the target and snaps on the first frame", () => {
    expect(easeRange(null, { lo: 1, hi: 2 }, 0.1)).toEqual({ lo: 1, hi: 2 });
    expect(easeRange({ lo: 0, hi: 10 }, { lo: 10, hi: 20 }, 0.5)).toEqual({ lo: 5, hi: 15 });
    expect(approach(0, 100)).toBe(0);
    expect(approach(1e9, 100)).toBeCloseTo(1);
  });
  it("picks nice ticks and enough label decimals", () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(83_001.3, 83_004.1, 5)).toEqual([83_002, 83_003, 83_004]);
    expect(niceTicks(83_001.3, 83_004.1, 10)).toEqual([83_001.5, 83_002, 83_002.5, 83_003, 83_003.5, 83_004]);
    expect(stepDecimals(0.5, 83_000)).toBe(1);
    expect(stepDecimals(0.25, 83_000)).toBe(2);
    expect(stepDecimals(5, 83_000)).toBe(0);
    expect(formatPrice(83_761.5)).toBe("83,761.50");
  });
  it("reads CSS number tokens", () => {
    expect(cssNumber(" 84 ", 0)).toBe(84);
    expect(cssNumber("", 7)).toBe(7);
  });
  it("says which side is winning, ties to Up", () => {
    expect(winning("up", 100, 100)).toBe(true);
    expect(winning("down", 100, 100)).toBe(false);
    expect(winning("down", 99, 100)).toBe(true);
    expect(winning(null, 1, 1)).toBeNull();
  });
});
