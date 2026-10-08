import { describe, expect, it } from "vitest";
import type { RestingExitC } from "@owarine/markets/ops/canton";
import { decideExit, effectiveStop, impliedPeak, levelBehind, nextPeak, shouldRatchet, stopHit } from "./rule";

const E8 = 100_000_000n;
const exit = (o: Partial<RestingExitC> = {}): RestingExitC => ({
  owner: "seat::1220ab", venue: "venue::1220cd", exitRef: "x1", termsCid: "00terms", marketId: "BTC-2m:7", outcome: "SideUp",
  lots: 10n, cashUnit: 1000n, floorTicks: 600, takeProfitTicks: null, stop: { stopE8: 100_000n * E8, trailBps: 10 }, expiresAtSec: 2_000,
  ...o,
});

describe("trail level", () => {
  it("sits trailBps behind the peak, on the right side for each outcome", () => {
    expect(levelBehind("SideUp", 100_000n * E8, 10)).toBe(99_900n * E8);
    expect(levelBehind("SideDown", 100_000n * E8, 10)).toBe(100_100n * E8);
  });

  it("recovers the peak a ledger level implies, so a restart resumes where the ledger is", () => {
    const peak = 101_000n * E8;
    expect(levelBehind("SideUp", impliedPeak("SideUp", levelBehind("SideUp", peak, 25), 25), 25)).toBe(levelBehind("SideUp", peak, 25));
  });

  it("moves the peak only in the position's favour", () => {
    expect(nextPeak("SideUp", 10n, 12n)).toBe(12n);
    expect(nextPeak("SideUp", 10n, 8n)).toBe(10n);
    expect(nextPeak("SideDown", 10n, 8n)).toBe(8n);
    expect(nextPeak("SideDown", 10n, 12n)).toBe(10n);
  });

  it("triggers on the better of the ledger level and the trail, never a worse one", () => {
    const x = exit({ stop: { stopE8: 100_000n * E8, trailBps: 10 } });
    expect(effectiveStop(x, 101_000n * E8)).toBe(levelBehind("SideUp", 101_000n * E8, 10));
    // a peak whose trail sits below the ledger level does not lower it
    expect(effectiveStop(x, 100_050n * E8)).toBe(100_000n * E8);
    // a fixed stop never trails
    expect(effectiveStop(exit({ stop: { stopE8: 5n, trailBps: null } }), 100n)).toBe(5n);
  });

  it("is hit when the spot crosses against the position", () => {
    expect(stopHit("SideUp", 100n, 100n)).toBe(true);
    expect(stopHit("SideUp", 100n, 101n)).toBe(false);
    expect(stopHit("SideDown", 100n, 100n)).toBe(true);
    expect(stopHit("SideDown", 100n, 99n)).toBe(false);
  });
});

describe("decideExit", () => {
  const bids: Array<[number, bigint]> = [[650, 6n], [620, 10n], [580, 50n]];

  it("waits while the spot is above an Up stop", () => {
    expect(decideExit({ exit: exit(), held: 10n, spotE8: 100_500n * E8, stopE8: 100_000n * E8, bids }).kind).toBe("wait");
  });

  it("fills at the bid when the stop is hit, using only levels at or above the floor", () => {
    const d = decideExit({ exit: exit(), held: 10n, spotE8: 99_000n * E8, stopE8: 100_000n * E8, bids });
    // 6 @ 650 + 4 @ 620 = 6380 → 638 average, floored
    expect(d).toEqual({ kind: "fill", trigger: "stop", lots: 10n, priceTicks: 638, proceedsBase: 10n * 638n * 1000n });
  });

  it("fills part when the depth above the floor runs out; the rest keeps resting", () => {
    const d = decideExit({ exit: exit({ lots: 40n }), held: 40n, spotE8: 1n, stopE8: 100_000n * E8, bids });
    expect(d.kind).toBe("fill");
    if (d.kind === "fill") expect(d.lots).toBe(16n);
  });

  it("holds when a gap leaves nothing at or above the floor", () => {
    const d = decideExit({ exit: exit({ floorTicks: 700 }), held: 10n, spotE8: 1n, stopE8: 100_000n * E8, bids });
    expect(d.kind).toBe("hold");
  });

  it("never sells more than the seat holds or the exit names", () => {
    const d = decideExit({ exit: exit({ lots: 100n }), held: 3n, spotE8: 1n, stopE8: 100_000n * E8, bids });
    expect(d.kind === "fill" && d.lots).toBe(3n);
    expect(decideExit({ exit: exit(), held: 0n, spotE8: 1n, stopE8: 1n, bids }).kind).toBe("wait");
  });

  it("takes profit once the bid reaches the take-profit, never below it", () => {
    const tp = exit({ stop: null, takeProfitTicks: 640, floorTicks: 500 });
    const d = decideExit({ exit: tp, held: 10n, spotE8: null, stopE8: null, bids });
    expect(d).toEqual({ kind: "fill", trigger: "take-profit", lots: 6n, priceTicks: 650, proceedsBase: 6n * 650n * 1000n });
    expect(decideExit({ exit: tp, held: 10n, spotE8: null, stopE8: null, bids: [[630, 50n]] }).kind).toBe("wait");
  });

  it("closes on the seat's tap at the bid, but not below what the seat confirmed", () => {
    expect(decideExit({ exit: exit(), held: 10n, spotE8: 200_000n * E8, stopE8: 100_000n * E8, bids, close: { minProceedsBase: 6_000_000n } }).kind).toBe("fill");
    expect(decideExit({ exit: exit(), held: 10n, spotE8: 200_000n * E8, stopE8: 100_000n * E8, bids, close: { minProceedsBase: 6_500_000n } }).kind).toBe("hold");
  });

  it("says when a stop cannot be judged for want of a spot", () => {
    expect(decideExit({ exit: exit(), held: 10n, spotE8: null, stopE8: 100_000n * E8, bids })).toEqual({ kind: "wait", why: "no fresh spot" });
  });
});

describe("shouldRatchet", () => {
  const x = exit({ stop: { stopE8: 100_000n * E8, trailBps: 20 } });

  it("moves the ledger level only in the owner's favour, by half a trail step, spaced out", () => {
    expect(shouldRatchet(x, 100_100n * E8, 60_000, 0, 10_000)).toBe(true);
    expect(shouldRatchet(x, 100_099n * E8, 60_000, 0, 10_000)).toBe(false);
    expect(shouldRatchet(x, 99_000n * E8, 60_000, 0, 10_000)).toBe(false);
    expect(shouldRatchet(x, 100_500n * E8, 5_000, 0, 10_000)).toBe(false);
  });

  it("never moves a fixed stop", () => {
    expect(shouldRatchet(exit({ stop: { stopE8: 1n, trailBps: null } }), 1_000n, 60_000, 0, 1)).toBe(false);
  });
});
