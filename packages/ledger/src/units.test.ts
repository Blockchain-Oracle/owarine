import { describe, expect, it } from "vitest";
import {
  INT64_MAX,
  UnitsError,
  ceilDiv,
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
