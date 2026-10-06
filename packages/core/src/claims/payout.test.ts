import { describe, expect, it } from "vitest";
import { enumerateClaimables, type SettledMarket } from "./enumerate";
import { apportionBase, legPayoutBase, winPayoutBase } from "./payout";
import { testAddress, testMarketId } from "../testing/ids";

const market: SettledMarket = {
  marketId: testMarketId(1),
  marketAddress: testAddress(2),
  asset: "TSLA",
  intervalSec: 300,
  expirySec: 1_000,
  decimals: 6,
  voided: false,
  winningOutcome: 0,
  resolvedAtMs: null,
};

describe("legPayoutBase (PM.Leg.legPayout)", () => {
  // The C2z rehearsal's own numbers: 4.00 backing + 0.05 fee on a 10-contract leg, cashUnit 1000 at 6 decimals.
  const leg = { quantityRaw: 10_000_000n, paidBase: 4_050_000n };

  it("pays a win its full quantity: nothing is taken at settlement", () => {
    expect(legPayoutBase(leg, "win")).toBe(10_000_000n);
    expect(winPayoutBase(1_000_001n)).toBe(1_000_001n);
  });

  it("returns a void's backing plus fee, never half a contract", () => {
    expect(legPayoutBase(leg, "void")).toBe(4_050_000n);
    expect(legPayoutBase(leg, "void")).not.toBe(leg.quantityRaw / 2n);
  });

  it("pays a loss nothing", () => {
    expect(legPayoutBase(leg, "loss")).toBe(0n);
  });

  it("apportions a reported total so the parts sum to it exactly", () => {
    expect(apportionBase(1_001n, [1n, 1n])).toEqual([500n, 501n]);
    expect(apportionBase(6_050_000n, [10n])).toEqual([6_050_000n]);
    expect(apportionBase(7n, [0n, 0n])).toEqual([0n, 0n]);
  });
});

describe("enumerateClaimables", () => {
  it("never rows a losing side and rows a void once with both legs", () => {
    const loss = enumerateClaimables([{ market, holdings: { upRaw: 0n, downRaw: 5n }, feeBps: 0 }]);
    expect(loss).toEqual([]);

    const voidMarket = { ...market, voided: true, winningOutcome: null };
    const voided = enumerateClaimables([{ market: voidMarket, holdings: { upRaw: 4n, downRaw: 2n }, feeBps: 0, paid: { up: 3n, down: 1n } }]);
    expect(voided).toHaveLength(1);
    expect(voided[0]?.legs.map((leg) => leg.payoutBase)).toEqual([3n, 1n]);
    expect(voided[0]?.netPayoutBase).toBe(4n);
    // Without what the legs cost there is no void row: a refund is never guessed from the size.
    expect(enumerateClaimables([{ market: voidMarket, holdings: { upRaw: 4n, downRaw: 2n }, feeBps: 0 }])).toEqual([]);
  });
});
