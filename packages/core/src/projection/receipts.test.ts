import { describe, expect, it } from "vitest";
import type { MarketId } from "../types/market";
import type { Signature } from "../types/primitives";
import { withReceipts, type ReceiptFacts } from "./receipts";
import type { SettledRound } from "./types";

const M = "mkt-1" as MarketId;
const market = { asset: "BTC", intervalSec: 300, expirySec: 1_000, resolvedAtMs: 1_010_000, question: null };
const r = (over: Partial<ReceiptFacts>): ReceiptFacts => ({
  receiptId: "r1", marketId: M, product: null, outcomeIdx: 0, resolvedIdx: 0, lots: 10n, cashUnit: 1000n, costBase: 5_100_000n, payoutBase: 10_000_000n,
  feeBase: 100_000n, detail: null, atMs: 1_020_000, txHash: "u-1" as Signature, market, ...over,
});

describe("settlement receipts in history (engine 0.4.0)", () => {
  it("attaches a pair leg's receipt to the round the fills built, keeping the fill figures", () => {
    const round = { marketId: M, source: "wallet", pnlBase: 4_900_000n, outcome: "win" } as SettledRound;
    const [out] = withReceipts([round], [r({})], 6);
    expect(out!.pnlBase).toBe(4_900_000n);
    expect(out!.receipt).toEqual({ product: null, receiptIds: ["r1"], costBase: 5_100_000n, payoutBase: 10_000_000n, feeBase: 100_000n, detail: null });
  });

  it("takes the ledger's own payout when the receipts cover every held leg (C9e): a void returns backing plus fee", () => {
    const replayed = {
      marketId: M, source: "wallet", outcome: "void", proceedsBase: 0n, stakeBase: 4_050_000n, payoutBase: 4_050_000n, pnlBase: 0n, feeBase: 0n,
      legs: [{ outcomeIdx: 0, amountRaw: 10_000_000n, payoutBase: 4_050_000n }],
    } as SettledRound;
    const voidReceipt = r({ resolvedIdx: null, costBase: 4_050_000n, payoutBase: 4_050_000n, feeBase: 0n });
    const [out] = withReceipts([replayed], [voidReceipt], 6);
    expect(out).toMatchObject({ outcome: "void", payoutBase: 4_050_000n, pnlBase: 0n });
    expect(out!.legs[0]!.payoutBase).toBe(4_050_000n);
    // A win the receipts cover: paid in full, the P&L against the stake that includes the fee.
    const won = withReceipts([{ ...replayed, outcome: "win", stakeBase: 5_100_000n, legs: [{ outcomeIdx: 0, amountRaw: 10_000_000n, payoutBase: 10_000_000n }] }], [r({})], 6)[0]!;
    expect(won).toMatchObject({ outcome: "win", payoutBase: 10_000_000n, pnlBase: 4_900_000n });
    // Not covered (only part of the held size has a receipt): the replay's figures stand.
    const partial = withReceipts([replayed], [r({ resolvedIdx: null, lots: 4n, payoutBase: 1_620_000n })], 6)[0]!;
    expect(partial.payoutBase).toBe(4_050_000n);
  });

  it("builds a round from pair-leg receipts alone: a winning Up leg, paid", () => {
    const [out] = withReceipts([], [r({})], 6);
    expect(out).toMatchObject({ marketId: M, asset: "BTC", outcome: "win", stakeBase: 5_100_000n, payoutBase: 10_000_000n, pnlBase: 4_900_000n, claim: "paid", fillCount: 0 });
    expect(out!.legs).toEqual([{ outcomeIdx: 0, amountRaw: 10_000_000n, payoutBase: 10_000_000n }]);
  });

  it("reads a void and a loss from the receipt's recorded outcome", () => {
    expect(withReceipts([], [r({ resolvedIdx: null, payoutBase: 5_100_000n })], 6)[0]!.outcome).toBe("void");
    expect(withReceipts([], [r({ resolvedIdx: 1, payoutBase: 0n })], 6)[0]!).toMatchObject({ outcome: "loss", pnlBase: -5_100_000n });
  });

  it("gives every ticket its own round, tagged with its product and the ledger's payout breakdown", () => {
    const detail = { reserveId: "range", marketIds: ["BTC-5m:7"], pick: "Inside 100..200", stakeBase: 5_000_000n, toReserveBase: 0n, result: "won" };
    const out = withReceipts([], [r({ receiptId: "t1", product: "range", lots: 1n, cashUnit: 1n, costBase: 5_000_000n, payoutBase: 12_000_000n, feeBase: 0n, detail }), r({ receiptId: "t2", product: "parlay", detail: { ...detail, reserveId: "parlay", result: "lost" }, payoutBase: 0n })], 6);
    expect(out.map((x) => [x.receipt?.product, x.outcome])).toEqual([["range", "win"], ["parlay", "loss"]]);
    expect(out[0]!.receipt).toMatchObject({ product: "range", detail });
    expect(out[0]!.legs).toEqual([]);
  });

  it("carries an event's question onto its round", () => {
    const [out] = withReceipts([], [r({ market: { ...market, asset: "EVT-DEMO-1", question: "Will it rain?" } })], 6);
    expect(out!.question).toBe("Will it rain?");
  });
});
