import { describe, expect, it } from "vitest";
import type { Active, LegC, ResolutionC } from "@agari/markets/ops/canton";
import { planNetting } from "../netting";
import { payoutOf, planBatches } from "./batches";

const V = "venue::1220ab";
const leg = (cid: string, owner: string, outcome: LegC["outcome"], over: Partial<LegC> = {}): Active<LegC> => ({
  cid,
  data: { venue: V, owner, termsCid: "t1", marketId: "BTC-1m:1", pairId: `p-${cid}`, outcome, lots: 10n, cashUnit: 1000n, backingShare: 6_000_000n, feePaid: 25_000n, refundAfterSec: 0, beneficiaryRef: null, ...over },
});
const res = (outcome: ResolutionC["outcome"]): ResolutionC => ({
  venue: V, resolver: "r", termsCid: "t1", marketId: "BTC-1m:1", outcome, voidReason: outcome ? null : { tag: "MissingPrint", slot: "CloseSlot" },
  openPriceE8: null, closePriceE8: null, openEvidence: [], closeEvidence: [], signers: 0,
});

describe("settle batches", () => {
  it("pays users first, then users' losing legs, then the venue's own, in batches of the given size", () => {
    const legs = [leg("v1", V, "SideDown"), leg("u-lose", "bob::1", "SideDown"), leg("u-win", "alice::1", "SideUp"), leg("v2", V, "SideUp")];
    expect(planBatches(legs, res("SideUp"), V, 2)).toEqual([["u-win", "u-lose"], ["v1", "v2"]]);
    expect(planBatches(legs, res(null), V, 25)).toEqual([["u-lose", "u-win", "v1", "v2"]]);
  });

  it("pays a winner the pair, a loser nothing, and refunds backing plus fee on a void", () => {
    const l = leg("u", "alice::1", "SideUp").data;
    expect(payoutOf(l, res("SideUp"))).toBe(10_000_000n);
    expect(payoutOf(l, res("SideDown"))).toBe(0n);
    expect(payoutOf(l, res(null))).toBe(6_025_000n);
  });
});

describe("netting plan", () => {
  it("merges a pair the venue holds both halves of, and crosses pairs only when asked and before resolution", () => {
    const pairUp = leg("a", V, "SideUp", { pairId: "p1" });
    const pairDown = leg("b", V, "SideDown", { pairId: "p1" });
    const crossUp = leg("c", V, "SideUp", { pairId: "p2" });
    const crossDown = leg("d", V, "SideDown", { pairId: "p3" });
    const other = leg("e", V, "SideDown", { pairId: "p4", lots: 7n });
    const all = [pairUp, pairDown, crossUp, crossDown, other];
    expect(planNetting(all, { crossPair: false, resolvedTerms: new Set() }).map(([x, y]) => [x.cid, y.cid])).toEqual([["a", "b"]]);
    expect(planNetting(all, { crossPair: true, resolvedTerms: new Set() }).map(([x, y]) => [x.cid, y.cid])).toEqual([["a", "b"], ["c", "d"]]);
    expect(planNetting(all, { crossPair: true, resolvedTerms: new Set(["t1"]) }).map(([x, y]) => [x.cid, y.cid])).toEqual([["a", "b"]]);
  });
});
