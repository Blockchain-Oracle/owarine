import { describe, expect, it } from "vitest";
import { DUEL, withUnit } from "./copy";

describe("duel stake labels (C9d)", () => {
  it("reads one credit in the singular, as the reference's `n === 1` copy does", () => {
    expect(DUEL.entry.tierUnits(1, "credits")).toBe("1 credit");
    expect(DUEL.entry.costPot("1", "credits")).toMatch(/^1 credit escrowed/);
    expect(DUEL.entry.balanceShort("1", "0.5", "credits")).toBe("This entry needs 1 credit and this seat holds 0.5.");
  });

  it("keeps the plural for every other amount, including 1.5 and 10", () => {
    expect(DUEL.entry.tierUnits(5, "credits")).toBe("5 credits");
    expect(withUnit("1.5", "credits")).toBe("1.5 credits");
    expect(withUnit(10, "credits")).toBe("10 credits");
    expect(withUnit(0, "credits")).toBe("0 credits");
  });

  it("leaves a ticker symbol alone", () => {
    expect(DUEL.entry.tierUnits(1, "tUSDC")).toBe("1 tUSDC");
  });
});
