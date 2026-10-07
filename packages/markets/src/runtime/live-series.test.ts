import { describe, expect, it } from "vitest";
import { append, mergeSeed, type LiveSeries } from "./live-series";

const series = (t: number[], p: number[]): LiveSeries => ({ t, p, version: 0, seeded: false });

describe("mergeSeed", () => {
  it("prepends history older than the first live tick", () => {
    const s = series([10_000, 10_400], [5, 6]);
    mergeSeed(s, [[7_000, 1], [8_000, 2], [9_000, 3], [10_000, 4]]);
    expect(s.t).toEqual([7_000, 8_000, 9_000, 10_000, 10_400]);
    expect(s.p).toEqual([1, 2, 3, 5, 6]);
    expect(s.version).toBe(1);
  });
  it("fills a gap the stream left, never replacing a live tick", () => {
    const s = series([1_000, 1_300, 9_000], [1, 2, 9]);
    mergeSeed(s, [[2_000, 3], [4_000, 4], [6_000, 5], [8_500, 6]]);
    expect(s.t).toEqual([1_000, 1_300, 4_000, 6_000, 9_000]);
    expect(s.p).toEqual([1, 2, 4, 5, 9]);
  });
  it("is a no-op when the seed adds nothing", () => {
    const s = series([1_000, 2_000], [1, 2]);
    mergeSeed(s, [[1_200, 9]]);
    expect(s.version).toBe(0);
    mergeSeed(s, []);
    expect(s.t).toEqual([1_000, 2_000]);
  });
});

describe("append", () => {
  it("keeps one sample a second, the latest tick winning", () => {
    const s = series([], []);
    expect(append(s, 1_100, 10)).toBe(true);
    expect(append(s, 1_700, 11)).toBe(true);
    expect(append(s, 2_050, 12)).toBe(true);
    expect(s.t).toEqual([1_700, 2_050]);
    expect(s.p).toEqual([11, 12]);
  });
  it("drops a tick older than the last sample and a repeat of it", () => {
    const s = series([5_000], [3]);
    expect(append(s, 4_000, 9)).toBe(false);
    expect(append(s, 5_000, 3)).toBe(false);
    expect(s.version).toBe(0);
  });
});
