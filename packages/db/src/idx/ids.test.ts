import { marketIdFromDaml } from "@owarine/core/market";
import { describe, expect, it } from "vitest";
import { marketIdOfKey, seriesIdOfKey } from "./ids";
import { offsetOf } from "./write";

describe("projection ids", () => {
  it("use the canonical core derivation (the id the seat routes return)", () => {
    expect(marketIdOfKey("BTC-300:12")).toBe(marketIdFromDaml("BTC-300:12"));
    expect(marketIdOfKey("BTC-300:12")).toBe("GAMChwcLrzqMGpUs32NDt6LKNTQ5DzbcSQKcThGk9Qmb");
    expect(seriesIdOfKey("BTC-300")).toBe("6nW79H2CfVZiDVxHZMLEMvyBbPpyZwjvH2kCR5DFdSFd");
  });
});

describe("offsetOf", () => {
  it("accepts int8 text within JS safe range and rejects the rest", () => {
    expect(offsetOf("417")).toBe(417);
    expect(offsetOf(9_007_199_254_740_991n)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => offsetOf("9007199254740993")).toThrow();
    expect(() => offsetOf(-1)).toThrow();
  });
});
