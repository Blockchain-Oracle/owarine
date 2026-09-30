import { describe, expect, it } from "vitest";
import { assetPairUnit, assetPriceLine, assetPriceParts, assetSpotLine, pointsLine } from "../hero/units";
import { pausedCopy, priceSourceLine } from "./lane-view";

const window = (asset: "TSLA" | "OPENAI" | "AILABS" | "BTC", lane: "regular" | "token") => ({ asset, lane, tradingStartSec: 1_790_000_000, expirySec: 1_790_003_600 }) as const;

describe("priceSourceLine (S19: the source is the asset's kind, not the lane)", () => {
  it("names the Jupiter Price v3 median only for an xStock, the PreStocks read for a pre-IPO name, and the index for a basket", () => {
    expect(priceSourceLine(window("TSLA", "token"))).toContain("Jupiter Price v3 median of three TSLAx");
    expect(priceSourceLine(window("TSLA", "token"))).not.toContain("Switchboard");
    const openai = priceSourceLine(window("OPENAI", "token"));
    expect(openai).toContain("PreStocks OpenAI token price");
    expect(openai).not.toContain("Jupiter");
    const ailabs = priceSourceLine(window("AILABS", "token"));
    expect(ailabs).toContain("AI Labs index, in points");
    expect(ailabs).toContain("OpenAI, Anthropic");
    expect(ailabs).not.toContain("Jupiter");
    expect(priceSourceLine(window("TSLA", "regular"))).not.toContain("Jupiter");
  });

  it("C6: every lane names its attested source; crypto names the three exchanges", () => {
    expect(priceSourceLine(window("BTC", "token"))).toContain("Coinbase, Kraken and Bitstamp");
    expect(priceSourceLine(window("BTC", "token"))).not.toContain("Switchboard");
    for (const a of ["TSLA", "OPENAI", "AILABS"] as const) expect(priceSourceLine(window(a, "token"))).toContain("attested by three oracle parties");
    expect(priceSourceLine(window("OPENAI", "token"))).not.toContain("signed by Agari");
  });
});

describe("pausedCopy (C6: the paused state says why)", () => {
  it("adds the roller's source reason under the line, and keeps the plain state plain", () => {
    const withWhy = pausedCopy("paused: no signed source (Switchboard Surge TSLAX/USD: crossbar HTTP 503)", "TSLAx", "token", 300);
    expect(withWhy.headline).toBe("Paused: no signed price source");
    expect(withWhy.why).toBe("No 5m TSLAx Window opens until a signed print can settle it. The other tickers keep rolling. Source check: Switchboard Surge TSLAX/USD: crossbar HTTP 503.");
    expect(pausedCopy("paused: no signed source", "QQQ", "regular", 300).why).not.toContain("Source check");
    expect(pausedCopy("paused: corporate action (split)", "TSLA", "regular", 300).why).not.toContain("Source check");
  });
});

describe("the basket unit (S19: points, never dollars)", () => {
  it("formats a basket's figures in points and everything else in dollars", () => {
    expect(pointsLine(100_420_000_000n)).toBe("1,004.20 pts");
    expect(assetPriceLine("AILABS", 100_420_000_000n)).toBe("1,004.20 pts");
    expect(assetPriceLine("AILABS", 42_000_000n, 100_000_000_000n)).toBe("0.42 pts");
    expect(assetPriceLine("OPENAI", 112_738_444_694n)).toBe("$1,127.38");
    expect(assetSpotLine("PREALL", 99_995_000_000n)).toBe("999.95 pts");
    expect(assetSpotLine("TSLA", 36_547_600_000n)).toBe("$365.47");
    expect(assetPriceParts("AILABS", 100_000_000_000n)).toEqual({ sign: "", figure: "1,000.00 pts" });
    expect(assetPriceParts("TSLA", 36_547_600_000n)).toEqual({ sign: "$", figure: "365.47" });
    expect(assetPairUnit("AILABS")).toBe("index");
    expect(assetPairUnit("TSLAx")).toBe("USD");
  });
});
