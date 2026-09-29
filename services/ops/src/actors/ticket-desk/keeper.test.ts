import type { Active, PriceQuoteC, TermsC } from "@agari/markets/ops/canton";
import { describe, expect, it } from "vitest";
import { beyondBarrier, countedAt, quorumPrint } from "./keeper";

const T = 1_790_000_040;
const terms = {
  symbol: "BTC", oracles: ["o1", "o2", "o3"], quorum: 2, maxDeviationBps: 100, barLenSec: 60, policyVersion: 1, minDelaySec: 5,
  expirySec: T + 60, closeDeadlineSec: T + 100,
} as unknown as TermsC;
const q = (oracle: string, priceE8: bigint, o: Partial<PriceQuoteC> = {}): Active<PriceQuoteC> => ({
  cid: `${oracle}-${priceE8}-${o.fetchedAtSec ?? T + 10}`,
  data: { oracle, venue: "v", resolver: "r", symbol: "BTC", boundarySec: T, priceE8, barStartSec: T - 60, barLenSec: 60, fetchedAtSec: T + 10, payloadHash: "h", policyVersion: 1, ...o },
});

describe("the knock-out's quorum (Boost_KnockOut's PrintRule)", () => {
  it("counts only the Window's oracles, bar, policy and admission window, first per oracle", () => {
    const quotes = [
      q("o1", 100n), q("o1", 999n, { fetchedAtSec: T + 20 }), q("o2", 101n), q("x", 50n),
      q("o3", 102n, { fetchedAtSec: T + 1 }), q("o3", 103n, { barLenSec: 300 }), q("o3", 104n, { symbol: "ETH" }),
    ];
    expect(countedAt(terms, T, quotes).map((c) => c.data.priceE8)).toEqual([100n, 101n]);
  });
  it("takes the lower median and applies the deviation limit", () => {
    expect(quorumPrint([q("o1", 100n), q("o2", 101n)], 100)).toEqual({ median: 100n, disagrees: false });
    expect(quorumPrint([q("o1", 100n), q("o2", 110n), q("o3", 105n)], 100)).toEqual({ median: 105n, disagrees: true });
  });
  it("knocks an Up boost out at or below its barrier, a Down one at or above", () => {
    expect(beyondBarrier({ side: "SideUp", barrierE8: 100n }, 100n)).toBe(true);
    expect(beyondBarrier({ side: "SideUp", barrierE8: 100n }, 101n)).toBe(false);
    expect(beyondBarrier({ side: "SideDown", barrierE8: 100n }, 100n)).toBe(true);
    expect(beyondBarrier({ side: "SideDown", barrierE8: 100n }, 99n)).toBe(false);
  });
});
