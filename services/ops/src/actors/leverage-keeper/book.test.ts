import type { PriceQuoteC } from "@owarine/markets/ops/canton";
import { describe, expect, it } from "vitest";
import { describeBook, markBoost } from "./book";

const B = 1_791_250_000;
const terms = { symbol: "BTC", oracles: ["o1", "o2", "o3"], quorum: 2, maxDeviationBps: 100, barLenSec: 60, policyVersion: 1, minDelaySec: 0, closeDeadlineSec: B + 400, expirySec: B + 300 } as never;
const quote = (oracle: string, boundarySec: number, priceE8: bigint) => ({ cid: `${oracle}${boundarySec}`, data: { oracle, symbol: "BTC", boundarySec, priceE8, barLenSec: 60, policyVersion: 1, fetchedAtSec: boundarySec + 12 } }) as never as { cid: string; data: PriceQuoteC };
const boost = (side: "SideUp" | "SideDown", barrierE8: bigint, fronted = 100n) => ({ cid: "00b", data: { marketId: "BTC-5m:3", side, barrierE8, fronted, barrierFromSec: B + 30, expirySec: B + 300 } }) as never;

describe("C-OPS-09: the Boost book against the oracle quorum", () => {
  const quotes = [quote("o1", B + 60, 8_500_000n), quote("o2", B + 60, 8_501_000n), quote("o1", B + 120, 8_480_000n), quote("o2", B + 120, 8_481_000n), quote("o3", B + 120, 8_482_000n)];

  it("marks a position on the newest quorum print in its life and says when it is past the barrier", () => {
    const safe = markBoost(boost("SideUp", 8_400_000n), terms, quotes);
    expect(safe).toMatchObject({ boundarySec: B + 120, medianE8: 8_481_000n, knockable: false });
    expect(safe.distanceBps).toBe(95);
    expect(markBoost(boost("SideUp", 8_490_000n), terms, quotes)).toMatchObject({ knockable: true, distanceBps: -10 });
    expect(markBoost(boost("SideDown", 8_470_000n), terms, quotes)).toMatchObject({ knockable: true });
  });

  it("a 1x boost has no barrier, and a boundary short of quorum is not a print", () => {
    expect(markBoost(boost("SideUp", 0n, 0n), terms, quotes)).toMatchObject({ barrierless: true, medianE8: null });
    expect(markBoost(boost("SideUp", 8_400_000n), terms, quotes.slice(0, 1))).toMatchObject({ medianE8: null });
  });

  it("the heartbeat names the closest position and any the quorum crossed", () => {
    const marks = [markBoost(boost("SideUp", 8_400_000n), terms, quotes), markBoost(boost("SideUp", 8_490_000n), terms, quotes)];
    expect(describeBook(marks)).toBe("2 live boost(s), 2 with a barrier · closest BTC-5m:3 Up -10 bps from its barrier · 1 past its barrier at a quorum print: the venue's keeper knocks it out");
  });
});
