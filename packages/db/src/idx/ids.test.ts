import { isAddress } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { marketIdOfKey, seriesIdOfKey } from "./ids";
import { offsetOf } from "./write";

describe("ledger text ids", () => {
  it("a Window's MarketId is base58 of 32 bytes, deterministic, and distinct per window", () => {
    const a = marketIdOfKey("BTC-300:12");
    expect(isAddress(a)).toBe(true);
    expect(marketIdOfKey("BTC-300:12")).toBe(a);
    expect(marketIdOfKey("BTC-300:13")).not.toBe(a);
    expect(seriesIdOfKey("BTC-300")).not.toBe(a);
  });

  it("pins the derivation (sha256 of the utf-8 text, base58): other lanes derive the same id", () => {
    expect(marketIdOfKey("")).toBe("GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn");
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
