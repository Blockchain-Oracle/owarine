import { computeTraderEdge, type SettledRound, type WalletHistory } from "@owarine/core/projection";
import { deriveVerdict } from "@owarine/core/claims";
import type { MarketId } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { awaitingSettledCost, settledCostBasis } from "./useVerdict";

/**
 * C4f, found by C11b on the phone: a settled Window's verdict read "No entry cost on record for this seat — showing the
 * payout". The legs leave the positions at the settle; the cost is on the ledger's settlement receipt, which reaches the
 * history a beat later. The verdict takes the round's cost (the receipt's, or the fill replay's; net of anything sold
 * back) and waits for it rather than calling it unknown. Figures: C11b's BTC-1m:53, 1 lot Up at 663 + fee 2,235, lost.
 */
const M = "BTC-1m:53" as MarketId;
const round = (over: Partial<SettledRound>): SettledRound =>
  ({ marketId: M, asset: "BTC", intervalSec: 60, expirySec: 1_791_000_060, settledAtMs: 1_791_000_061_000, openedAtMs: 1_791_000_015_000, decimals: 6, outcome: "loss", stakeBase: 665_235n, proceedsBase: 0n, payoutBase: 0n, pnlBase: -665_235n, feeBase: 2_235n, legs: [{ outcomeIdx: 0, amountRaw: 1_000_000n, payoutBase: 0n }], ...over }) as SettledRound;
const history = (rounds: SettledRound[], complete = true): WalletHistory => ({ rounds, openCount: 0, fillCount: rounds.length, complete, decimals: 6 });
const settlement = { isResolved: true, isVoided: false, winningOutcome: 1 as const };

describe("a settled Window's cost basis (C4f)", () => {
  it("is the round's stake: the receipt's backing plus fee", () => {
    expect(settledCostBasis(M, history([round({})]))).toBe(665_235n);
  });

  it("nets out what was sold back, as the record does", () => {
    const sold = round({ stakeBase: 1_330_470n, proceedsBase: 600_000n, payoutBase: 0n, pnlBase: -730_470n });
    expect(settledCostBasis(M, history([sold]))).toBe(730_470n);
  });

  it("is unknown only while the history has no round for the Window", () => {
    expect(settledCostBasis(M, history([round({ marketId: "BTC-1m:54" as MarketId })]))).toBeNull();
    expect(settledCostBasis(M, null)).toBeNull();
  });

  it("gives the verdict the record's P&L, never the payout", () => {
    const h = history([round({})]);
    const verdict = deriveVerdict({ marketId: M, settlement, holdings: { upRaw: 1_000_000n, downRaw: 0n }, feeBps: 0, decimals: 6, costBasisBase: settledCostBasis(M, h), settledAtMs: null });
    expect(verdict).toMatchObject({ outcome: "loss", costBasisBase: 665_235n, pnlBase: -665_235n });
    expect(verdict!.pnlBase).toBe(computeTraderEdge(h.rounds, 0).netBase);
  });
});

describe("the verdict waits for the ledger's record of a held Window (C4f)", () => {
  const base = { costBasisBase: null, heldRaw: 1_000_000n, voided: false, marketId: M };

  it("waits while the history is loading or has not caught up with the settle", () => {
    expect(awaitingSettledCost({ ...base, history: null })).toBe(true);
    expect(awaitingSettledCost({ ...base, history: history([]) })).toBe(true);
  });

  it("stops waiting once a cost is known, nothing was held, or the Window voided (the refund prices it)", () => {
    expect(awaitingSettledCost({ ...base, costBasisBase: 665_235n, history: history([]) })).toBe(false);
    expect(awaitingSettledCost({ ...base, heldRaw: 0n, history: history([]) })).toBe(false);
    expect(awaitingSettledCost({ ...base, voided: true, history: history([]) })).toBe(false);
  });

  it("does not wait on a history too long to read whole: there the cost is honestly unknown", () => {
    expect(awaitingSettledCost({ ...base, history: history([], false) })).toBe(false);
  });
});
