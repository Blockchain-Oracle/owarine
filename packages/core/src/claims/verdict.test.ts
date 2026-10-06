import { describe, expect, it } from "vitest";
import { deriveVerdict, verdictPriceable, type VerdictInput } from "./verdict";
import { testMarketId } from "../testing/ids";

const ONE = 1_000_000n;
const marketId = testMarketId(1);

const base = (overrides: Partial<VerdictInput>): VerdictInput => ({
  marketId,
  settlement: { isResolved: true, isVoided: false, winningOutcome: 0 },
  holdings: { upRaw: 10n * ONE, downRaw: 0n },
  feeBps: 0,
  decimals: 6,
  costBasisBase: 5n * ONE,
  settledAtMs: null,
  ...overrides,
});

describe("deriveVerdict", () => {
  it("stamps a win at one credit per contract against the cost basis: nothing is taken at settlement", () => {
    const verdict = deriveVerdict(base({ feeBps: 100 }));
    expect(verdict?.outcome).toBe("win");
    expect(verdict?.payoutBase).toBe(10_000_000n);
    expect(verdict?.pnlBase).toBe(5_000_000n);
  });

  it("stamps one net card when both sides were held, listing both legs", () => {
    const verdict = deriveVerdict(base({ holdings: { upRaw: 4n * ONE, downRaw: 10n * ONE }, costBasisBase: 7n * ONE }));
    expect(verdict?.outcome).toBe("loss");
    expect(verdict?.legs.map((leg) => [leg.outcomeIdx, leg.payoutBase])).toEqual([
      [0, 4n * ONE],
      [1, 0n],
    ]);
    expect(verdict?.pnlBase).toBe(-3n * ONE);
  });

  it("returns a void's backing plus fee per side from the ledger's own figures, P&L zero", () => {
    const voided = deriveVerdict(
      base({ settlement: { isResolved: false, isVoided: true, winningOutcome: null }, holdings: { upRaw: 10n * ONE, downRaw: 2n * ONE }, costBasisBase: 6_060_000n, paidBySide: { up: 4_050_000n, down: 2_010_000n } }),
    );
    expect(voided?.outcome).toBe("void");
    expect(voided?.legs.map((leg) => [leg.outcomeIdx, leg.payoutBase])).toEqual([
      [0, 4_050_000n],
      [1, 2_010_000n],
    ]);
    expect(voided?.payoutBase).toBe(6_060_000n);
    expect(voided?.pnlBase).toBe(0n);
    // Not half the contracts (the reference engine's rule): 12 contracts would have paid 6.00.
    expect(voided?.payoutBase).not.toBe(6n * ONE);
  });

  it("prices a one-sided void from the cost basis, and the cost basis from the refund when none is on record", () => {
    const voidSettlement = { isResolved: false, isVoided: true, winningOutcome: null };
    expect(deriveVerdict(base({ settlement: voidSettlement, costBasisBase: 6_050_000n }))?.payoutBase).toBe(6_050_000n);
    const fromLedger = deriveVerdict(base({ settlement: voidSettlement, costBasisBase: null, paidBySide: { up: 6_050_000n, down: 0n } }));
    expect(fromLedger?.costBasisBase).toBe(6_050_000n);
    expect(fromLedger?.pnlBase).toBe(0n);
  });

  it("never guesses a void's refund, and never stamps an unsettled or empty window", () => {
    const unpriced = { settlement: { isResolved: false, isVoided: true, winningOutcome: null }, costBasisBase: null, paidBySide: null };
    expect(verdictPriceable(unpriced)).toBe(false);
    expect(deriveVerdict(base(unpriced))).toBeNull();
    expect(deriveVerdict(base({ settlement: { isResolved: false, isVoided: false, winningOutcome: null } }))).toBeNull();
    expect(deriveVerdict(base({ holdings: { upRaw: 0n, downRaw: 0n } }))).toBeNull();
  });
});
