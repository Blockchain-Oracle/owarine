import { describe, expect, it } from "vitest";
import { LedgerError } from "@agari/ledger";
import { decodeQuote, decodeResolution, decodeTerms, isoOfSec, timeSec } from "./decode";
import { creditCommandId, expireCommandId, settleBatchCommandId, skipToCommandId } from "./ids";
import { costOf, feeFor, walkStake } from "./quote-walk";
import { inactiveCids, isInactive, refusalId } from "./session";

const T = 1_790_000_000;

describe("decoders", () => {
  it("reads MarketTerms times as epoch seconds and Ints exactly", () => {
    const [tradingStart, expiry] = [isoOfSec(T), isoOfSec(T + 60)];
    const t = decodeTerms({
      venue: "v::1", resolver: "r::1", seriesKey: "BTC-1m", marketId: "BTC-1m:7", index: "7", symbol: "BTC", cashUnit: "1000",
      tradingStart, lockAt: isoOfSec(T + 50), expiry, openDeadline: isoOfSec(T + 50), closeDeadline: "2026-09-21T20:14:40.123456Z",
      refundAfter: isoOfSec(T + 400), policyVersion: "1", printSource: "attested", minDelaySec: "5", barLenSec: "60", tieUp: true,
      oracles: ["a::1", "b::1", "c::1"], quorum: "2", maxDeviationBps: "100",
    });
    expect(t).toMatchObject({ index: 7, cashUnit: 1000n, tradingStartSec: T, expirySec: T + 60, quorum: 2, tieUp: true });
    expect(t.closeDeadlineSec).toBe(timeSec("2026-09-21T20:14:40Z"));
  });

  it("reads a void resolution's reason and an outcome's absence", () => {
    const r = decodeResolution({
      venue: "v", resolver: "r", termsCid: "00ab", marketId: "BTC-1m:7", outcome: null,
      voidReason: { tag: "QuorumNotMet", value: { slot: "CloseSlot" } }, openPriceE8: "6500000000000", closePriceE8: null,
      openEvidence: [{ oracle: "a", priceE8: "6500000000000", fetchedAt: isoOfSec(T + 10), payloadHash: "h", quoteCid: "00cd" }], closeEvidence: [], signers: "1",
    });
    expect(r.outcome).toBeNull();
    expect(r.voidReason).toEqual({ tag: "QuorumNotMet", slot: "CloseSlot" });
    expect(r.openPriceE8).toBe(6_500_000_000_000n);
    expect(r.openEvidence[0]!.fetchedAtSec).toBe(T + 10);
  });

  it("refuses a float where a Daml Int belongs", () => {
    expect(() =>
      decodeQuote({ venue: "v", user: "u", termsCid: "c", marketId: "m", pairId: "p", side: "SideUp", priceTicks: 500, lots: "1", cashUnit: "1", fee: "0", validUntil: isoOfSec(T), lockAt: isoOfSec(T), refundAfter: isoOfSec(T) }),
    ).toThrow(/priceTicks/);
  });
});

describe("command ids", () => {
  it("are stable per action and refuse what a ledger string cannot carry", () => {
    expect(skipToCommandId("BTC-1m", 42)).toBe("skip:BTC-1m:42");
    expect(settleBatchCommandId("res", ["b", "a"])).toBe(settleBatchCommandId("res", ["a", "b"]));
    expect(settleBatchCommandId("res", ["a"])).not.toBe(settleBatchCommandId("res", ["a", "b"]));
    expect(creditCommandId("seat-1::1220ab", "lease-9")).toMatch(/^credit:[0-9a-f]{32}:lease-9$/);
    expect(() => expireCommandId("00ab.cd")).toThrow();
  });
});

describe("ladder walk", () => {
  it("computes the fee exactly with the ceiling", () => {
    // 10 lots × 1000 × cu 1000 = 10^7 quantity; × 100 bps × 500 × 500 / 10^10 = 25_000 exactly.
    expect(feeFor(10n, 500, 1000n, 100)).toBe(25_000n);
    expect(feeFor(1n, 1, 1n, 1)).toBe(1n);
    expect(feeFor(10n, 500, 1000n, 0)).toBe(0n);
  });

  it("buys the most lots the stake covers, fee included, at the rounded-up average price", () => {
    const levels = [[520, 10n], [530, 10n], [540, 100n]] as const;
    const q = walkStake(levels, 12_000_000n, 1000n, 100)!;
    // 22 lots: 10×520 + 10×530 + 2×540 = 11_580 ticks → avg ⌈526.36⌉ = 527.
    expect(q.lots).toBe(22n);
    expect(q.priceTicks).toBe(527);
    expect(q.costBase).toBe(22n * 527n * 1000n + q.fee);
    expect(q.costBase).toBeLessThanOrEqual(12_000_000n);
    expect(costOf(23n, levels, 1000n, 100)!.costBase).toBeGreaterThan(12_000_000n);
    expect(q.venueStakeBase).toBe(22n * 473n * 1000n);
  });

  it("stops at the ladder's depth and the per-quote cap, and answers null when nothing fits", () => {
    expect(walkStake([[500, 3n]], 10n ** 12n, 1000n, 0)!.lots).toBe(3n);
    expect(walkStake([[500, 300n]], 10n ** 12n, 1000n, 0, { maxLots: 50n })!.lots).toBe(50n);
    expect(walkStake([[500, 3n]], 100n, 1000n, 0)).toBeNull();
    expect(walkStake([], 10n ** 9n, 1000n, 0)).toBeNull();
  });
});

describe("refusal reading", () => {
  const rejected = (code: string, message: string) =>
    new LedgerError({ kind: "rejected", path: "/v2/commands/submit-and-wait-for-transaction", message, canton: { code, cause: message, errorCategory: 9, context: {} } });
  it("finds the engine's refusal id and the inactive contract ids", () => {
    expect(refusalId(rejected("DAML_FAILURE", "Interpretation error: abu-pm/quorum-not-met fewer distinct"))).toBe("abu-pm/quorum-not-met");
    const gone = rejected("CONTRACT_NOT_FOUND", "Contract could not be found with id 00aa11");
    expect(isInactive(gone)).toBe(true);
    expect(inactiveCids(gone, ["00aa11", "00bb22"])).toEqual(["00aa11"]);
    expect(isInactive(new Error("x"))).toBe(false);
    // Canton 3.5 rejects an input archived before routing this way (C8e, the ticket desk under load)
    const routed = rejected("UNKNOWN_CONTRACT_SYNCHRONIZERS", "The following contracts have been archived: List(00cc33, 00dd44)");
    expect(isInactive(routed)).toBe(true);
    expect(inactiveCids(routed, ["00aa11", "00cc33"])).toEqual(["00cc33"]);
  });
});
