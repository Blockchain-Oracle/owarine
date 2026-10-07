import { describe, expect, it } from "vitest";
import { buildLadder, quotingUntilSec } from "./ladder";
import { createLadderBoard, ladderChanged, type LadderEntry } from "./ladder-board";

const base = { halfSpreadTicks: 30, minTick: 20, levels: 3, stepTicks: 5, lotsPerLevel: 100n, cashUnit: 1000n, capBase: 10n ** 12n, usedUpBase: 0n, usedDownBase: 0n };

describe("venue price ladder", () => {
  it("offers Up at fair + half and Down at 1000 − (fair − half), with depth behind each", () => {
    const l = buildLadder({ ...base, fairTicks: 600 });
    expect(l.up).toEqual([[630, 100n], [635, 100n], [640, 100n]]);
    expect(l.down).toEqual([[430, 100n], [435, 100n], [440, 100n]]);
  });

  it("stops each side where its venue-stake cap runs out", () => {
    // Up at 630 locks 370 × 1000 per lot: a cap of 50,000,000 with 20,000,000 used leaves 81 lots.
    const l = buildLadder({ ...base, fairTicks: 600, capBase: 50_000_000n, usedUpBase: 20_000_000n });
    expect(l.up).toEqual([[630, 81n]]);
    expect(l.down.length).toBe(1);
    expect(buildLadder({ ...base, fairTicks: 600, capBase: 1n }).up).toEqual([]);
  });

  it("never quotes past 1000 − minTick, and pins a lopsided side to the edge (quotePair)", () => {
    const l = buildLadder({ ...base, fairTicks: 975 });
    expect(l.up).toEqual([[980, 100n]]);
    expect(l.down[0]![0]).toBe(1000 - 945);
  });

  it("stops quoting in a Window's last minute, scaled for a short lane, and never past lock", () => {
    expect(quotingUntilSec({ tradingStartSec: 0, lockAtSec: 270, expirySec: 300 })).toBe(240);
    expect(quotingUntilSec({ tradingStartSec: 0, lockAtSec: 50, expirySec: 60 })).toBe(45);
    expect(quotingUntilSec({ tradingStartSec: 0, lockAtSec: 30, expirySec: 60 })).toBe(30);
  });
});

describe("ladderChanged (revamp step 2)", () => {
  const base: LadderEntry = {
    marketId: "m", damlMarketId: "BTC-1m:1", seriesId: "s", termsCid: "t", seriesKey: "k", symbol: "BTC", index: 1, tradingStartSec: 0, lockAtSec: 60, expirySec: 60,
    quotingUntilSec: 45, cashUnit: 1000n, feeRateBps: 100, fairTicks: 520, sigmaBps: 4000, yearSec: 31_536_000, minTick: 10, halfSpreadTicks: 30,
    openPriceE8: 1n, spotE8: 2n, up: [[550, 200n]], down: [[510, 200n]], asOfMs: 1, state: "quoting",
  };
  it("is silent when only spot and the clock moved", () => {
    expect(ladderChanged(base, { ...base, spotE8: 3n, asOfMs: 2, up: [[550, 200n]] })).toBe(false);
  });
  it("speaks when a level, the fair or the state changed", () => {
    expect(ladderChanged(undefined, base)).toBe(true);
    expect(ladderChanged(base, { ...base, up: [[555, 200n]] })).toBe(true);
    expect(ladderChanged(base, { ...base, down: [[510, 150n]] })).toBe(true);
    expect(ladderChanged(base, { ...base, fairTicks: 521 })).toBe(true);
    expect(ladderChanged(base, { ...base, state: "closed" })).toBe(true);
  });
  it("a board put of an unchanged ladder emits nothing", () => {
    const board = createLadderBoard();
    const seen: number[] = [];
    board.subscribe((e) => seen.push(e.asOfMs));
    board.put(base);
    board.put({ ...base, asOfMs: 2, spotE8: 9n });
    board.put({ ...base, asOfMs: 3, fairTicks: 530 });
    expect(seen).toEqual([1, 3]);
  });
});
