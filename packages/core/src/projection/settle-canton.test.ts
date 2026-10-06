import { describe, expect, it } from "vitest";
import { buildLedgers } from "./ledger";
import { settleRound } from "./settle";
import type { LedgerFill, RoundMarket } from "./types";
import { testMarketId, testSignature } from "../testing/ids";

/**
 * C9e: history replays settle by the ledger's own rule (`PM.Leg.legPayout`, abu-pm-main): the fee is paid with the stake
 * at the fill, a win pays one credit per contract in full, and a void returns the held legs' backing plus fee. A sale
 * (`BuyQuote_Accept`) gives the sold slice the ceiling of the backing and of the fee escrow; the kept leg keeps the rest.
 */
const M = testMarketId(0xc9);
const market = (over: Partial<RoundMarket>): RoundMarket => ({
  marketId: M, asset: "BTC", intervalSec: 60, expirySec: 2_000, decimals: 6, settled: true, voided: false, winningOutcome: 0, resolvedAtMs: 2_001_000, ...over,
});
// 10 contracts Up at 0.40 with a 0.05 fee: backing 4.00, cost 4.05 (the C2z rehearsal's void figures).
const buy: LedgerFill = { marketId: M, side: "BUY_YES", quantityRaw: 10_000_000n, yesPriceRaw: 400_000n, feeBase: 50_000n, atMs: 1_000, txHash: testSignature(1) };
// 4 of them sold back at 0.50.
const sale: LedgerFill = { marketId: M, side: "SELL_YES", quantityRaw: 4_000_000n, yesPriceRaw: 500_000n, atMs: 1_500, txHash: testSignature(2) };

const round = (fills: LedgerFill[], over: Partial<RoundMarket>) => settleRound({ ledger: buildLedgers(fills, [], 6).get(M)!, market: market(over), feeBps: 0, liveHoldings: null })!;

describe("settleRound on Canton's rule", () => {
  it("counts the fee as paid in and pays a win in full", () => {
    const won = round([buy], {});
    expect(won).toMatchObject({ outcome: "win", stakeBase: 4_050_000n, payoutBase: 10_000_000n, pnlBase: 5_950_000n, feeBase: 50_000n });
  });

  it("returns a void's backing plus fee, P&L zero, and the venue keeps no fee", () => {
    const voided = round([buy], { voided: true, winningOutcome: null });
    expect(voided).toMatchObject({ outcome: "void", payoutBase: 4_050_000n, pnlBase: 0n, feeBase: 0n });
    expect(voided.payoutBase).not.toBe(5_000_000n);
  });

  it("splits a sale the way the ledger does: the kept leg keeps the rest of the backing and of the fee", () => {
    const voided = round([buy, sale], { voided: true, winningOutcome: null });
    // Kept: backing 4.00 − ceil(1.60) = 2.40, fee 0.05 − ceil(0.02) = 0.03.
    expect(voided.legs).toEqual([{ outcomeIdx: 0, amountRaw: 6_000_000n, payoutBase: 2_430_000n }]);
    // The fee on the sold slice was kept at the sale; the held escrow came back.
    expect(voided.feeBase).toBe(20_000n);
    expect(voided.pnlBase).toBe(2_000_000n + 2_430_000n - 4_050_000n);
    expect(round([buy, sale], {})).toMatchObject({ payoutBase: 6_000_000n, pnlBase: 3_950_000n, feeBase: 50_000n });
  });
});
