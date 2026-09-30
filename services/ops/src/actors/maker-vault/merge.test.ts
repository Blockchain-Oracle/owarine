import { describe, expect, it } from "vitest";
import type { Active, LegC } from "@agari/markets/ops/canton";
import { planNetting } from "../netting";
import { planBookMerges } from "./earn";

const V = "venue::1";
const BOOK = "reserve:maker";
const leg = (cid: string, o: Partial<LegC>): Active<LegC> => ({
  cid,
  data: { venue: V, owner: V, termsCid: "t1", marketId: "BTC-300:1", pairId: "p", outcome: "SideUp", lots: 2n, cashUnit: 1n, backingShare: 800n, feePaid: 0n, refundAfterSec: 9_999, beneficiaryRef: BOOK, bookCost: null, ...o },
});

describe("the maker's merge crank", () => {
  it("nets the same pair first, then equal size across pairs, each leg once", () => {
    const legs = [
      leg("a", { pairId: "p1", outcome: "SideUp" }),
      leg("b", { pairId: "p2", outcome: "SideDown" }),
      leg("c", { pairId: "p1", outcome: "SideDown" }),
      leg("d", { pairId: "p3", outcome: "SideUp" }),
    ];
    expect(planBookMerges(legs).map(([x, y]) => [x.cid, y.cid])).toEqual([["a", "c"], ["d", "b"]]);
  });
  it("never nets different sizes or Windows", () => {
    expect(planBookMerges([leg("a", {}), leg("b", { outcome: "SideDown", lots: 3n }), leg("c", { outcome: "SideDown", termsCid: "t2" })])).toEqual([]);
  });
});

describe("venue netting with books (abu-pm-main 0.5.0)", () => {
  it("never pairs a book's leg with the desk's, even on the same pair", () => {
    const up = leg("up", { pairId: "p1", outcome: "SideUp" });
    const deskDown = leg("dd", { pairId: "p1", outcome: "SideDown", beneficiaryRef: null });
    expect(planNetting([up, deskDown], { crossPair: true, resolvedTerms: new Set() })).toEqual([]);
    const bookDown = leg("bd", { pairId: "p1", outcome: "SideDown" });
    expect(planNetting([up, deskDown, bookDown], { crossPair: false, resolvedTerms: new Set() }).map(([a, b]) => [a.cid, b.cid])).toEqual([["up", "bd"]]);
  });
});
