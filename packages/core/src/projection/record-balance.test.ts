import { describe, expect, it } from "vitest";
import { formatBaseUnits } from "../units/format";
import { testMarketId, testSignature } from "../testing/ids";
import { computeTraderEdge } from "./edge";
import { buildLedgers } from "./ledger";
import { withReceipts, type ReceiptFacts } from "./receipts";
import { settleRound } from "./settle";
import type { LedgerFill, RoundMarket } from "./types";

/**
 * C4f: "Your record" is what the seat's balance did. C11b read −0.82 and −1.69 while the balance moved −0.833068 and
 * −1.704464: the replay left out the fee the ledger charges with the stake at the fill (`PM.Leg.feePaid`). These are
 * the three settled calls of the C4f drive on a local sandbox (seat-1, 6 Oct), fees included, read back from the ledger:
 *
 *   BTC-1m:7  Up 2 lots at 467 + fee 4,979     lost   receipt cost 938,979  paid 0
 *   BTC-1m:8  Down 1 lot at 688 + fee 2,147    won    receipt cost 690,147  paid 1,000,000
 *   BTC-1m:9  Up 2 lots at 375 + fee 4,688     void   receipt cost 754,688  paid 754,688
 *
 * The seat's `VenueCash` went 1,000,000,000 → 999,370,874 over them.
 */
const [M7, M8, M9] = [testMarketId(7), testMarketId(8), testMarketId(9)];
const fill = (marketId: typeof M7, side: LedgerFill["side"], lots: bigint, yesTicks: bigint, feeBase: bigint, n: number): LedgerFill => ({
  marketId, side, quantityRaw: lots * 1_000_000n, yesPriceRaw: yesTicks * 1_000n, feeBase, atMs: n * 60_000, txHash: testSignature(n),
});
const fills = [fill(M7, "BUY_YES", 2n, 467n, 4_979n, 1), fill(M8, "BUY_NO", 1n, 312n, 2_147n, 2), fill(M9, "BUY_YES", 2n, 375n, 4_688n, 3)];
const market = (marketId: typeof M7, n: number, over: Partial<RoundMarket>): RoundMarket => ({
  marketId, asset: "BTC", intervalSec: 60, expirySec: n * 60 + 60, decimals: 6, settled: true, voided: false, winningOutcome: 1, resolvedAtMs: (n * 60 + 61) * 1000, ...over,
});
const receipt = (marketId: typeof M7, n: number, outcomeIdx: 0 | 1, resolvedIdx: 0 | 1 | null, lots: bigint, costBase: bigint, payoutBase: bigint, feeBase: bigint): ReceiptFacts => ({
  receiptId: `r${n}`, marketId, product: null, outcomeIdx, resolvedIdx, lots, cashUnit: 1_000n, costBase, payoutBase, feeBase, detail: null,
  atMs: (n * 60 + 61) * 1000, txHash: testSignature(10 + n), market: { asset: "BTC", intervalSec: 60, expirySec: n * 60 + 60, resolvedAtMs: (n * 60 + 61) * 1000, question: null },
});

function record() {
  const ledgers = buildLedgers(fills, [], 6);
  const markets = [market(M7, 1, {}), market(M8, 2, {}), market(M9, 3, { voided: true, winningOutcome: null })];
  const rounds = markets.map((m) => settleRound({ ledger: ledgers.get(m.marketId)!, market: m, feeBps: 0, liveHoldings: { upRaw: 0n, downRaw: 0n } })!);
  const receipts = [
    receipt(M7, 1, 0, 1, 2n, 938_979n, 0n, 4_979n),
    receipt(M8, 2, 1, 1, 1n, 690_147n, 1_000_000n, 2_147n),
    receipt(M9, 3, 0, null, 2n, 754_688n, 754_688n, 0n),
  ];
  return withReceipts(rounds, receipts, 6);
}

describe("the record is what the seat's balance did (C4f)", () => {
  it("counts the fee paid at each fill: each round's stake is its receipt's cost", () => {
    const rounds = record();
    expect(rounds.map((r) => [r.outcome, r.stakeBase, r.payoutBase, r.pnlBase])).toEqual([
      ["loss", 938_979n, 0n, -938_979n],
      ["win", 690_147n, 1_000_000n, 309_853n],
      ["void", 754_688n, 754_688n, 0n],
    ]);
  });

  it("nets to the ledger's own cash movement, and reads to the cent as the balance does", () => {
    const edge = computeTraderEdge(record(), 0);
    const start = 1_000_000_000n;
    const after = 999_370_874n;
    expect(edge.netBase).toBe(after - start);
    expect(formatBaseUnits(edge.netBase, 6)).toBe("-0.63");
    expect(formatBaseUnits(after, 6)).toBe("999.37");
  });
});
