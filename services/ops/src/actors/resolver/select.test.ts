import { describe, expect, it } from "vitest";
import type { Active, PriceQuoteC, TermsC } from "@owarine/markets/ops/canton";
import { evidenceFor, lowerMedian, slotRule } from "./select";

const T = 1_790_000_000 - (1_790_000_000 % 60);
const terms: TermsC = {
  venue: "v", resolver: "r", seriesKey: "BTC-1m", marketId: "BTC-1m:1", index: 1, symbol: "BTC", cashUnit: 1000n,
  tradingStartSec: T, lockAtSec: T + 50, expirySec: T + 60, openDeadlineSec: T + 50, closeDeadlineSec: T + 100, refundAfterSec: T + 400,
  policyVersion: 1, printSource: "attested", minDelaySec: 5, barLenSec: 60, tieUp: true, oracles: ["a", "b", "c"], quorum: 2, maxDeviationBps: 100,
};
let n = 0;
const q = (oracle: string, boundarySec: number, fetchedAtSec: number, priceE8: bigint, over: Partial<PriceQuoteC> = {}): Active<PriceQuoteC> => ({
  cid: `cid${n++}`,
  data: { oracle, venue: "v", resolver: "r", symbol: "BTC", boundarySec, priceE8, barStartSec: boundarySec - 60, barLenSec: 60, fetchedAtSec, payloadHash: "h", policyVersion: 1, ...over },
});

describe("the resolver's evidence", () => {
  it("counts only this slot's quotes inside [T + minDelay, deadline], one per listed oracle, the earliest", () => {
    const quotes = [
      q("a", T, T + 10, 100n), q("a", T, T + 12, 90n), // a's later duplicate is ignored
      q("b", T, T + 3, 101n), // before T + minDelay: ignored
      q("b", T, T + 11, 102n),
      q("c", T, T + 51, 103n), // after the open-print cutoff: ignored
      q("d", T, T + 10, 1n), // not in the terms' list
      q("a", T + 60, T + 70, 200n), // the close boundary
      q("c", T, T + 10, 104n, { policyVersion: 2 }), // another policy version
    ];
    const open = evidenceFor(slotRule(terms, "open"), quotes);
    expect(open.map((e) => [e.data.oracle, e.data.priceE8])).toEqual([["a", 100n], ["b", 102n]]);
    const close = evidenceFor(slotRule(terms, "close"), quotes);
    expect(close.map((e) => e.data.oracle)).toEqual(["a"]);
  });

  it("takes the lower middle of an even count, as the ledger does", () => {
    expect(lowerMedian([3n, 1n, 2n])).toBe(2n);
    expect(lowerMedian([4n, 1n, 3n, 2n])).toBe(2n);
    expect(lowerMedian([])).toBeNull();
  });
});
