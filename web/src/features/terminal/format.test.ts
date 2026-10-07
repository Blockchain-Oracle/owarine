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
