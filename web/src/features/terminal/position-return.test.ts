import type { LivePnlView } from "@owarine/markets/react";
import { describe, expect, it } from "vitest";
import { positionReturn } from "./position-return";

const p = { costBasisBase: 45_020_000n, decimals: 6, expirySec: 120 };
const quote: LivePnlView = { exitBase: 50_000_000n, fillableLots: 76n, heldLots: 76n, upPriceTicks: 658, downPriceTicks: null, locked: false, costBasisBase: p.costBasisBase, pnlBase: 4_980_000n, fairTicks: 688, shiftTicks: 0, live: true, spotE8: 8_159_803_000_000n };

describe("open position returns", () => {
  it("does not turn a missing quote into the reported 0.00% ROI", () => {
    expect(positionReturn(p, null, 100)).toEqual({ status: "unavailable", pnl: null, roi: null, canTrade: false });
  });
  it("uses the cash-out value against the actual stake, including fees", () => {
    const value = positionReturn(p, quote, 100);
    expect(value.pnl).toBe(4.98);
    expect(value.roi).toBeCloseTo(11.06175, 4);
    expect(value.canTrade).toBe(true);
    expect(positionReturn(p, { ...quote, pnlBase: -4_980_000n }, 100).roi).toBeCloseTo(-11.06175, 4);
  });
  it("preserves a genuine break-even quote", () => {
    expect(positionReturn(p, { ...quote, pnlBase: 0n }, 100)).toMatchObject({ pnl: 0, roi: 0, status: "priced" });
  });
  it("does not present the cost fallback of locked or bidless lots as zero ROI", () => {
    expect(positionReturn(p, { ...quote, locked: true, pnlBase: 0n, fillableLots: 0n }, 100)).toMatchObject({ status: "locked", pnl: null, roi: null, canTrade: false });
    expect(positionReturn(p, { ...quote, fillableLots: 0n }, 100).roi).toBeNull();
  });
  it("does not show an expired quote as a settlement result", () => {
    expect(positionReturn(p, quote, 120)).toMatchObject({ status: "settling", pnl: null, roi: null, canTrade: false });
    expect(positionReturn(p, null, 121).status).toBe("settling");
  });
  it("labels a reconnecting feed's last quote and keeps partial-fill accounting", () => {
    expect(positionReturn(p, { ...quote, live: false, heldLots: 152n }, 100)).toMatchObject({ status: "stale", pnl: 4.98 });
  });
  it("does not divide by zero when a cost is unavailable", () => {
    expect(positionReturn({ ...p, costBasisBase: 0n }, quote, 100).roi).toBeNull();
  });
});
