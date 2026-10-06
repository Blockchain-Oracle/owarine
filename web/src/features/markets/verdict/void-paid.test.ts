import type { SettledRound } from "@agari/core/projection";
import type { ClaimableRow, MarketId } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { voidPaidBySide } from "./useVerdict";

/** C9e: a void verdict prices each side from the ledger's own legs, never from half the contracts. */
const M = "BTC-1m:17" as MarketId;
const claimable = (over: Partial<ClaimableRow>): ClaimableRow =>
  ({ kind: "void", marketId: M, legs: [{ outcomeIdx: 0, amountRaw: 10_000_000n, payoutBase: 4_050_000n }], netPayoutBase: 4_050_000n, feeBps: 0, decimals: 6, ...over }) as ClaimableRow;
const round = (over: Partial<SettledRound>): SettledRound =>
  ({ marketId: M, outcome: "void", legs: [{ outcomeIdx: 0, amountRaw: 10_000_000n, payoutBase: 4_050_000n }, { outcomeIdx: 1, amountRaw: 2_000_000n, payoutBase: 810_000n }], ...over }) as SettledRound;

describe("voidPaidBySide", () => {
  it("reads a claimable void's legs first: backing plus fee per side", () => {
    expect(voidPaidBySide(M, [claimable({})], null)).toEqual({ up: 4_050_000n, down: 0n });
    expect(voidPaidBySide(M, [claimable({ kind: "stale-refund" })], null)).toEqual({ up: 4_050_000n, down: 0n });
  });

  it("falls back to the settled round once the settler paid", () => {
    expect(voidPaidBySide(M, [], [round({})])).toEqual({ up: 4_050_000n, down: 810_000n });
  });

  it("says nothing for a win, another Window, or nothing read", () => {
    expect(voidPaidBySide(M, [claimable({ kind: "win" })], [round({ outcome: "win" })])).toBeNull();
    expect(voidPaidBySide(M, [claimable({ marketId: "ETH-1m:3" as MarketId })], null)).toBeNull();
    expect(voidPaidBySide(M, null, null)).toBeNull();
  });
});
