import { describe, expect, it } from "vitest";
import {
  ATOMIC_PER_COIN,
  INT64_MAX,
  MAX_ATOMIC,
  UnitsError,
  atomicPerCashUnit,
  atomicToCashUnitsExact,
  atomicToCc,
  cashUnitsToCc,
  ccRateOk,
  ccToAtomic,
  ccToCashUnitsExact,
  ceilDiv,
  floorCashUnits,
  isWholeCashUnits,
  largestAcceptedCc,
  maxCashUnits,
  fee,
  fromDamlInt,
  fromDamlNumeric,
  quantity,
  toDamlInt,
  toDamlNumeric,
  userStake,
  venueStake,
} from "./units";

describe("Daml Int", () => {
  it("round-trips int64 bounds as strings", () => {
    expect(fromDamlInt("9223372036854775807")).toBe(INT64_MAX);
    expect(toDamlInt(-(2n ** 63n))).toBe("-9223372036854775808");
    expect(fromDamlInt("-42")).toBe(-42n);
  });
  it("refuses numbers, decimals and overflow", () => {
    expect(() => fromDamlInt(42)).toThrow(UnitsError);
    expect(() => fromDamlInt("1.0")).toThrow(UnitsError);
    expect(() => fromDamlInt("9223372036854775808")).toThrow(/overflows/);
    expect(() => toDamlInt(INT64_MAX + 1n)).toThrow(/overflows/);
  });
});

describe("Daml Numeric", () => {
  it("parses the ledger's 10-place form exactly", () => {
    expect(fromDamlNumeric("1.5000000000")).toBe(15_000_000_000n);
    expect(fromDamlNumeric("1.5", 6)).toBe(1_500_000n);
    expect(fromDamlNumeric("-0.000001", 6)).toBe(-1n);
    expect(fromDamlNumeric("12.340000", 2)).toBe(1234n); // trailing zeros beyond scale are fine
  });
  it("never rounds", () => {
    expect(() => fromDamlNumeric("0.0000001", 6)).toThrow(/more than 6/);
    expect(() => fromDamlNumeric(1.5)).toThrow(UnitsError);
    expect(() => fromDamlNumeric("1e3")).toThrow(UnitsError);
  });
  it("formats with exactly `decimals` places", () => {
    expect(toDamlNumeric(15_000_000_000n)).toBe("1.5000000000");
    expect(toDamlNumeric(-1n, 6)).toBe("-0.000001");
    expect(toDamlNumeric(7n, 0)).toBe("7");
    expect(fromDamlNumeric(toDamlNumeric(123_456_789n, 4), 4)).toBe(123_456_789n);
  });
});

describe("ticks, lots and fees", () => {
  it("stakes sum to the pair quantity exactly", () => {
    for (const t of [1n, 250n, 500n, 999n]) {
      expect(userStake(3n, t, 1000n) + venueStake(3n, t, 1000n)).toBe(quantity(3n, 1000n));
    }
  });
  it("rejects ticks outside 1..999", () => {
    expect(() => userStake(1n, 0n, 1n)).toThrow(/ticks/);
    expect(() => venueStake(1n, 1000n, 1n)).toThrow(/ticks/);
  });
  it("ceilDiv is (a+b-1)/b", () => {
    expect(ceilDiv(0n, 7n)).toBe(0n);
    expect(ceilDiv(7n, 7n)).toBe(1n);
    expect(ceilDiv(8n, 7n)).toBe(2n);
  });
  it("fee = ceil(quantity × bps × t × (1000−t) / 1e10)", () => {
    // 10 lots × 1000 × cashUnit 1000 = 1e7; 100 bps at t=500: 1e7 × 100 × 250000 / 1e10 = 25000 exactly
    expect(fee(10n, 500n, 1000n, 100n)).toBe(25_000n);
    // 1 lot, cashUnit 1, 1 bps, t=1: 1000 × 1 × 999 / 1e10 → ceil to 1
    expect(fee(1n, 1n, 1n, 1n)).toBe(1n);
    expect(fee(1n, 1n, 1n, 0n)).toBe(0n);
  });
  it("refuses a fee whose Daml Int product would overflow", () => {
    expect(() => fee(10n ** 9n, 500n, 10n ** 6n, 10_000n)).toThrow(/overflows/);
  });
});

// C7b: the Canton Coin rail's CIP-56 edge. The same vectors as `Test.CC.Deposit.testUnitsArithmetic` in Daml.
describe("Canton Coin at the CIP-56 edge", () => {
  const RATE = 100_000n; // 1 coin = 100000 cash units; one cash unit = 10^5 atomic

  it("converts a Decimal exactly, with the Daml toAtomic vectors", () => {
    expect(ccToAtomic("1.0")).toBe(ATOMIC_PER_COIN);
    expect(ccToAtomic("0.0000000001")).toBe(1n);
    expect(ccToAtomic("12.5")).toBe(125_000_000_000n);
    expect(ccToAtomic("9999999.9999999999")).toBe(MAX_ATOMIC - 1n);
    expect(ccToAtomic("10000000.0")).toBe(MAX_ATOMIC);
    expect(() => ccToAtomic("10000000.0000000001")).toThrow(/above/);
    expect(() => ccToAtomic("0.0")).toThrow(/positive/);
    expect(() => ccToAtomic("-1.0")).toThrow(UnitsError);
    expect(() => ccToAtomic("0.00000000001")).toThrow(/more than 10/);
    expect(() => ccToAtomic(1.5)).toThrow(UnitsError);
  });

  it("round-trips atomic units through the wire string", () => {
    for (const a of [1n, 7n, 99_999n, 100_000n, 123_456_789n, 99_999_999_999n, MAX_ATOMIC]) expect(ccToAtomic(atomicToCc(a))).toBe(a);
    expect(atomicToCc(125_000_000_000n)).toBe("12.5000000000");
    expect(() => atomicToCc(MAX_ATOMIC + 1n)).toThrow(UnitsError);
    expect(() => atomicToCc(-1n)).toThrow(UnitsError);
  });

  it("accepts only rates that divide 10^10", () => {
    for (const ok of [100_000n, 1_000_000n, 10_000_000_000n, 1n, 2n, 5n]) expect(ccRateOk(ok)).toBe(true);
    for (const bad of [3n, 0n, -1n, 20_000_000_000n, 7n]) expect(ccRateOk(bad)).toBe(false);
    expect(() => atomicPerCashUnit(3n)).toThrow(/divide/);
    expect(atomicPerCashUnit(RATE)).toBe(100_000n);
  });

  it("credits exact cash units and refuses dust, never rounding", () => {
    expect(atomicToCashUnitsExact(1_000_000n, RATE)).toBe(10n);
    expect(() => atomicToCashUnitsExact(1_000_001n, RATE)).toThrow(/dust/);
    expect(() => atomicToCashUnitsExact(99_999n, RATE)).toThrow(/dust/);
    expect(() => atomicToCashUnitsExact(0n, RATE)).toThrow(/positive/);
    expect(ccToCashUnitsExact("12.5", RATE)).toBe(1_250_000n);
    expect(() => ccToCashUnitsExact("1.000001", RATE)).toThrow(/dust/);
    expect(isWholeCashUnits(1_000_000n, RATE)).toBe(true);
    expect(isWholeCashUnits(1_000_001n, RATE)).toBe(false);
  });

  it("withdraws cash units as an exact coin amount, bounded", () => {
    expect(cashUnitsToCc(400_000n, RATE)).toBe("4.0000000000");
    expect(cashUnitsToCc(1n, RATE)).toBe("0.0000100000");
    expect(ccToCashUnitsExact(cashUnitsToCc(123_457n, RATE), RATE)).toBe(123_457n);
    expect(cashUnitsToCc(maxCashUnits(RATE), RATE)).toBe(atomicToCc(MAX_ATOMIC));
    expect(() => cashUnitsToCc(maxCashUnits(RATE) + 1n, RATE)).toThrow(/bounds/);
    expect(() => cashUnitsToCc(0n, RATE)).toThrow(/bounds/);
  });

  it("rounds only the assets side, and down", () => {
    expect(floorCashUnits(1_099_999n, RATE)).toBe(10n);
    expect(floorCashUnits(99_999n, RATE)).toBe(0n);
    expect(floorCashUnits(1_100_000n, RATE) * atomicPerCashUnit(RATE)).toBeLessThanOrEqual(1_100_000n);
  });

  it("rounds what a form accepts down to the granule, never up", () => {
    expect(largestAcceptedCc("1.000001", RATE)).toBe("1.0000000000");
    expect(largestAcceptedCc("1.000019", RATE)).toBe("1.0000100000");
    expect(largestAcceptedCc("0.000001", RATE)).toBeNull();
    expect(largestAcceptedCc("2.5", RATE)).toBe("2.5000000000");
  });
});
