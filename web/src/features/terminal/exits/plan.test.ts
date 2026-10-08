import { describe, expect, it } from "vitest";
import { costTicks, proceedsAt, stopE8Of, stopOnLosingSide, takeProfitTicks, trailBpsOf, trailFloorTicks } from "./plan";

// 10 lots at cashUnit 1000 = 10,000,000 contracts raw; cost 6.2 credits (6,200,000 base) → 620 ticks a lot.
const C = 10_000_000n;
const COST = 6_200_000n;

describe("exit plan", () => {
  it("prices the position per lot, rounding break-even up", () => {
    expect(costTicks(COST, C)).toBe(620);
    expect(costTicks(COST + 1n, C)).toBe(621);
  });

  it("puts a trail's floor at break-even less the slippage, on the grid", () => {
    expect(trailFloorTicks(COST, C, 200)).toBe(607);
    expect(trailFloorTicks(10n * C, C, 0)).toBe(999);
    expect(trailFloorTicks(0n, C, 200)).toBe(1);
  });

  it("finds the price that pays cost plus the target, or none past a whole payout", () => {
    expect(takeProfitTicks(COST, C, 1_000_000n)).toBe(720);
    expect(proceedsAt(720, C) - COST).toBe(1_000_000n);
    expect(takeProfitTicks(COST, C, 4_000_000n)).toBeNull();
    expect(takeProfitTicks(COST, C, 0n)).toBeNull();
  });

  it("writes a stop level in the position's favour", () => {
    expect(stopE8Of("up", 100_000.123456789)).toBe(10_000_012_345_678n);
    expect(stopE8Of("down", 100_000.123456781)).toBe(10_000_012_345_679n);
  });

  it("keeps the trail on the ledger's range and stops on the losing side", () => {
    expect(trailBpsOf(0.001)).toBe(10);
    expect(trailBpsOf(0.9)).toBe(5000);
    expect(stopOnLosingSide("up", 99, 100)).toBe(true);
    expect(stopOnLosingSide("down", 99, 100)).toBe(false);
  });
});
