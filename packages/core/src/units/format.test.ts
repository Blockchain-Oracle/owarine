import { describe, expect, it } from "vitest";
import { formatBaseUnits } from "./format";

/**
 * C4f: the record, the verdict and the balance agree to the cent. Live on a local sandbox a seat's settled calls netted
 * −629,126 base (−0.629126 credits); its balance went from 1,000.00 to 999.370874, shown 999.37, and the record said
 * "−0.62". Money now floors past the shown places, so a loss shows the whole cents it took.
 */
describe("formatBaseUnits", () => {
  it("shows a balance's whole cents, as before", () => {
    expect(formatBaseUnits(999_370_874n, 6)).toBe("999.37");
    expect(formatBaseUnits(1_000_000_000n, 6)).toBe("1,000.00");
    expect(formatBaseUnits(139_788n, 6, { signed: true })).toBe("+0.13");
  });

  it("shows a loss as the whole cents the balance lost", () => {
    const start = 1_000_000_000n;
    const net = -629_126n;
    expect(formatBaseUnits(net, 6)).toBe("-0.63");
    // start − shown balance = shown loss, at the shown precision
    expect(formatBaseUnits(start + net, 6)).toBe("999.37");
    expect(formatBaseUnits(-1_704_464n, 6)).toBe("-1.71");
    expect(formatBaseUnits(-833_068n, 6)).toBe("-0.84");
  });

  it("leaves an exact figure, and every figure at full precision, untouched", () => {
    expect(formatBaseUnits(-660_000n, 6)).toBe("-0.66");
    expect(formatBaseUnits(-629_126n, 6, { maxDp: 6, minDp: 2 })).toBe("-0.629126");
    expect(formatBaseUnits(-5n, 2, { maxDp: 4 })).toBe("-0.05");
    expect(formatBaseUnits(0n, 6)).toBe("0.00");
  });
});
