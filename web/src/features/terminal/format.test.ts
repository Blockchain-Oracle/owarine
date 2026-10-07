import { describe, expect, it } from "vitest";
import { fixedText } from "./format";

describe("fixedText", () => {
  it("rounds the shown decimal half up, not the double beneath it", () => {
    expect((191.475).toFixed(2)).toBe("191.47");
    expect(fixedText(191.475, 2)).toBe("191.48");
    expect(fixedText(-38.25, 1)).toBe("38.3");
    expect(fixedText(0.1 + 0.2, 2)).toBe("0.30");
  });
});

describe("livePnlText", () => {
  it("keeps Tradash's magnitude decimals with a true minus", async () => {
    const { livePnlText } = await import("./format");
    expect(livePnlText(41_200n, 6)).toBe("+0.0412");
    expect(livePnlText(12_345_000n, 6)).toBe("+12.345");
    expect(livePnlText(-1_204_500_000n, 6)).toBe("−1,204.50");
  });
});
