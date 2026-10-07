import { describe, expect, it } from "vitest";
import { formatOdometer } from "./odometer-format";

describe("formatOdometer", () => {
  it("groups dollars and keeps fixed decimals", () => {
    expect(formatOdometer(1284.5, "usd", 2, false)).toBe("$1,284.50");
  });
  it("signs PnL with a plus or a real minus, never on zero", () => {
    expect(formatOdometer(1.23456, "pnl", 4, true)).toBe("+$1.2346");
    expect(formatOdometer(-0.5, "pnl", 2, true)).toBe("−$0.50");
    expect(formatOdometer(-0.00001, "pnl", 2, true)).toBe("$0.00");
  });
  it("writes percents of a percent value", () => {
    expect(formatOdometer(4.2, "pct", 2, true)).toBe("+4.20%");
  });
  it("treats a non-number as zero", () => {
    expect(formatOdometer(Number.NaN, "plain", 0, false)).toBe("0");
  });
});
