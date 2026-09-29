import { describe, expect, it } from "vitest";
import { isMarketId } from "@agari/core/types";
import type { JsTransaction } from "@agari/ledger";
import type { LegView, ResolutionView, TermsView } from "./contracts";
import { appMarketId, seatCommandId } from "./ids";
import { balanceSheet, busyUntilMs, claimables, claimPlans, contractsOf, legPayout, openPositions, openQuotes } from "./map";
import { bookedFrom, paidTo, selectCash } from "./writes";

const DAML_ID = "PRB-60:0";
const MARKET = appMarketId(DAML_ID);
const T = Date.parse("2026-09-29T12:00:00Z");

const leg = (o: Partial<LegView> = {}): LegView => ({
  cid: "00leg",
  damlMarketId: DAML_ID,
  marketId: MARKET,
  termsCid: "00terms",
  pairId: "p1",
  side: "up",
  lots: 10n,
  cashUnit: 10n,
  // 10 lots at 620 ticks: 10 × 620 × 10
  backingShare: 62_000n,
  feePaid: 1_414n,
  refundAfterMs: T + 900_000,
  createdAtMs: T,
  ...o,
});
const terms: TermsView = { cid: "00terms", damlMarketId: DAML_ID, marketId: MARKET, seriesKey: "PRB-60", symbol: "PRB", cashUnit: 10n, tradingStartMs: T, lockAtMs: T + 50_000, expiryMs: T + 60_000, refundAfterMs: T + 900_000 };
const resolution = (outcome: ResolutionView["outcome"]): ResolutionView => ({ cid: "00res", termsCid: "00terms", damlMarketId: DAML_ID, outcome, voidReason: outcome === null ? "QuorumNotMet" : null, createdAtMs: T + 70_000, disclosure: { createdEventBlob: "blob", templateId: "pkg:PM.Market:Resolution", contractId: "00res", synchronizerId: "sync" } });

describe("ids", () => {
  it("derives a stable base58 market id from the Daml market id", () => {
    expect(isMarketId(MARKET)).toBe(true);
    expect(appMarketId(DAML_ID)).toBe(MARKET);
    expect(appMarketId("PRB-60:1")).not.toBe(MARKET);
  });
  it("makes ledger-string command ids from a journal uuid only", () => {
    expect(seatCommandId("accept", "0B6F3A7E-58A1-4D4E-9B1A-2F1F6C1F0A11")).toBe("accept:0b6f3a7e-58a1-4d4e-9b1a-2f1f6c1f0a11");
    expect(() => seatCommandId("claim", "not-a-uuid")).toThrow();
  });
});

describe("units (plan §7)", () => {
  it("a lot pays 1000 × cashUnit, so the pair's two stakes sum to its backing", () => {
    expect(contractsOf(10n, 10n)).toBe(100_000n);
    const l = leg();
    expect(l.backingShare + 10n * (1000n - 620n) * 10n).toBe(contractsOf(l.lots, l.cashUnit));
  });

  it("pays a winner its contracts, a loser nothing, a void its backing plus fee", () => {
    expect(legPayout(leg(), { outcome: "up" })).toBe(100_000n);
    expect(legPayout(leg(), { outcome: "down" })).toBe(0n);
    expect(legPayout(leg(), { outcome: null })).toBe(63_414n);
  });
});

describe("seat mapping", () => {
  it("balance is the sum of the seat's own cash; no escrow, no fee token", () => {
    const sheet = balanceSheet({ party: "p", offset: 1, cash: [{ cid: "a", amount: 5n, bucket: "demo" }, { cid: "b", amount: 7n, bucket: "change" }], legs: [], quotes: [] });
    expect(sheet).toEqual({ decimals: 6, spendableBase: 12n, nativeLamports: 0n, orderEscrowBase: 0n, venueCreditBase: 0n, venueCreditByMarket: [], vaultBase: null });
  });

  it("groups legs into one position per Window, marked at entry", () => {
    const rows = openPositions([leg(), leg({ cid: "00leg2", side: "down", backingShare: 38_000n, feePaid: 0n })], new Map([["00terms", terms]]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ marketId: MARKET, asset: "PRB", intervalSec: 60, expirySec: Math.floor((T + 60_000) / 1000), balanceUpRaw: 100_000n, balanceDownRaw: 100_000n, costBasisBase: 101_414n, markValueBase: 100_000n, unrealizedPnlBase: -1_414n });
    expect(openPositions([leg()], new Map())).toEqual([]);
  });

  it("claims after a resolution, refunds after refundAfter with none, and nothing before", () => {
    const res = new Map([["00terms", resolution("up")]]);
    expect(claimPlans([leg()], res, T)).toMatchObject([{ kind: "claim", payoutBase: 100_000n }]);
    expect(claimPlans([leg()], new Map(), T + 899_999)).toEqual([]);
    // DA.Assert.assertDeadlineExceeded passes AT the deadline.
    expect(claimPlans([leg()], new Map(), T + 900_000)).toMatchObject([{ kind: "stale-refund", payoutBase: 63_414n }]);
  });

  it("lists only exits that pay, with the kind the surfaces know", () => {
    const t = new Map([["00terms", terms]]);
    expect(claimables(claimPlans([leg({ side: "down" })], new Map([["00terms", resolution("up")]]), T), t)).toEqual([]);
    const [win] = claimables(claimPlans([leg()], new Map([["00terms", resolution("up")]]), T), t);
    expect(win).toMatchObject({ kind: "win", marketId: MARKET, netPayoutBase: 100_000n, legs: [{ outcomeIdx: 0, amountRaw: 100_000n, payoutBase: 100_000n }], settledAtMs: T + 70_000 });
    const [voided] = claimables(claimPlans([leg()], new Map([["00terms", resolution(null)]]), T), t);
    expect(voided).toMatchObject({ kind: "void", netPayoutBase: 63_414n });
    const [stale] = claimables(claimPlans([leg()], new Map(), T + 900_000), t);
    expect(stale).toMatchObject({ kind: "stale-refund", settledAtMs: null });
  });

  it("an open quote costs lots × ticks × cashUnit + fee", () => {
    const [q] = openQuotes([{ cid: "00q", damlMarketId: DAML_ID, marketId: MARKET, termsCid: "00terms", pairId: "p", side: "up", priceTicks: 620n, lots: 10n, cashUnit: 10n, fee: 1_414n, validUntilMs: T + 20_000, lockAtMs: T + 50_000, refundAfterMs: T + 900_000 }]);
    expect(q).toMatchObject({ costBase: 63_414n, contractsRaw: 100_000n });
  });

  it("the busy clock is the last refund deadline or live quote expiry", () => {
    expect(busyUntilMs({ legs: [], quotes: [] })).toBe(0);
    expect(busyUntilMs({ legs: [leg()], quotes: [] })).toBe(T + 900_000);
  });
});

describe("writes: cash selection and booking from the created Leg", () => {
  it("selects the largest cash first and refuses when it cannot cover", () => {
    const cash = [{ cid: "a", amount: 10n }, { cid: "b", amount: 50n }, { cid: "c", amount: 30n }];
    expect(selectCash(cash, 40n)).toEqual(["b"]);
    expect(selectCash(cash, 70n)).toEqual(["b", "c"]);
    expect(selectCash(cash, 91n)).toBeNull();
  });

  // The Canton wire field, by shorthand (the time-suffix rule reads `name:` literals).
  const createdAt = "2026-09-29T12:00:05Z";
  const tx: JsTransaction = {
    updateId: "1220" + "ab".repeat(32),
    effectiveAt: "2026-09-29T12:00:05Z",
    offset: 99,
    synchronizerId: "sync",
    recordTime: "2026-09-29T12:00:05Z",
    events: [
      { ArchivedEvent: { offset: 99, nodeId: 0, contractId: "00q", templateId: "pkg:PM.Quote:Quote", packageName: "abu-pm-main", witnessParties: ["seat"] } },
      { CreatedEvent: { offset: 99, nodeId: 1, contractId: "00legU", templateId: "pkg:PM.Leg:Leg", packageName: "abu-pm-main", witnessParties: ["seat"], signatories: ["venue", "seat"], createdAt,
        createArgument: { venue: "venue", owner: "seat", termsCid: "00terms", marketId: DAML_ID, pairId: "p", outcome: "SideUp", lots: "10", cashUnit: "10", backingShare: "62000", feePaid: "1414", refundAfter: "2026-09-29T12:15:00Z", beneficiaryRef: null } } },
      { CreatedEvent: { offset: 99, nodeId: 2, contractId: "00legV", templateId: "pkg:PM.Leg:Leg", packageName: "abu-pm-main", witnessParties: ["seat"], signatories: ["venue"], createdAt,
        createArgument: { venue: "venue", owner: "venue", termsCid: "00terms", marketId: DAML_ID, pairId: "p", outcome: "SideDown", lots: "10", cashUnit: "10", backingShare: "38000", feePaid: "0", refundAfter: "2026-09-29T12:15:00Z", beneficiaryRef: null } } },
      { CreatedEvent: { offset: 99, nodeId: 3, contractId: "00change", templateId: "pkg:PM.Money:VenueCash", packageName: "abu-pm-main", witnessParties: ["seat"], signatories: ["venue", "seat"], createdAt,
        createArgument: { venue: "venue", owner: "seat", amount: "936586", bucket: "change" } } },
    ],
  };

  it("books the seat's own leg, never the venue's, and never from the request", () => {
    expect(bookedFrom(tx, "seat")).toEqual({ marketId: MARKET, side: "up", contractsRaw: 100_000n, costBase: 63_414n, avgPriceBps: 6_200, txHash: tx.updateId, fillCount: 1 });
    expect(() => bookedFrom(tx, "someone-else")).toThrow(/no leg/);
    expect(paidTo(tx, "seat")).toBe(936_586n);
  });
});
