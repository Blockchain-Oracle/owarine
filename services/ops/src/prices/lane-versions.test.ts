import { describe, expect, it } from "vitest";
import { attestedPrintSource, primarySourceAt, type TickerSymbol, type XStockSymbol } from "@owarine/core/market";
import { equityVersions, laneVersionsOf, loadPriceSources, tokenLaneVersions, type PriceSourcesFile } from "./lane-versions";

const at = (iso: string) => Date.parse(iso) / 1000;
const sourceOf = (asset: TickerSymbol | XStockSymbol, iso: string) => primarySourceAt(laneVersionsOf(asset), at(iso));
/** The `printSource` text of the newest version covering `iso`: what the Series' policy says a Window opened then settles on. */
const textOf = (asset: TickerSymbol | XStockSymbol, iso: string) => {
  const versions = laneVersionsOf(asset);
  const source = primarySourceAt(versions, at(iso));
  const v = versions.filter((x) => x.primary === source && x.validFromSec <= at(iso)).at(-1);
  return v ? attestedPrintSource(v.primary, v.feed) : null;
};

describe("which source each lane settles on, dated", () => {
  const NOW = "2026-09-30T15:00:00Z";

  it("is RedStone for the seven single names, Alpaca for QQQ and VOO, Jupiter for the xStocks, PreStocks for pre-IPO names and baskets", () => {
    for (const asset of ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL"] as const) expect(sourceOf(asset, NOW)).toBe("redstone");
    for (const asset of ["QQQ", "VOO"] as const) expect(sourceOf(asset, NOW)).toBe("alpaca");
    for (const asset of ["TSLAx", "NVDAx", "SPYx", "QQQx"] as const) expect(sourceOf(asset, NOW)).toBe("jupiter");
    expect(sourceOf("OPENAI", NOW)).toBe("prestocks");
    expect(sourceOf("FIGUREAI", NOW)).toBe("prestocks");
    expect(sourceOf("AILABS", NOW)).toBe("basket");
    expect(sourceOf("PREALL", NOW)).toBe("basket");
  });

  it("names the feed a Series carries in its policy text", () => {
    expect(textOf("TSLA", NOW)).toBe("attested:redstone:TSLA");
    expect(textOf("QQQ", NOW)).toBe("attested:alpaca:QQQ");
    expect(textOf("TSLAx", NOW)).toBe("attested:jupiter:TSLAx");
    expect(textOf("OPENAI", NOW)).toBe("attested:prestocks:OPENAI");
    expect(textOf("AILABS", NOW)).toBe("attested:basket:AILABS");
    expect(textOf("TSLA", "2026-09-20T15:00:00Z")).toBe("attested:pyth:16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1");
  });

  it("keeps the history: TSLA on the Pyth trial until 09-25 20:00Z then RedStone; QQQ and VOO on Pyth, with no source until Alpaca on 09-29; xStocks on Surge, then Jupiter", () => {
    expect(sourceOf("TSLA", "2026-09-20T15:00:00Z")).toBe("pyth");
    expect(sourceOf("TSLA", "2026-09-25T20:00:00Z")).toBe("redstone");
    expect(sourceOf("QQQ", "2026-09-20T15:00:00Z")).toBe("pyth");
    expect(sourceOf("QQQ", "2026-09-27T15:00:00Z")).toBeNull();
    expect(sourceOf("VOO", "2026-09-28T23:59:59Z")).toBeNull();
    expect(sourceOf("VOO", "2026-09-29T00:00:00Z")).toBe("alpaca");
    expect(sourceOf("TSLAx", "2026-09-20T15:00:00Z")).toBe("switchboard");
    expect(sourceOf("TSLAx", "2026-09-29T00:00:00Z")).toBe("jupiter");
  });

  it("has nothing for crypto, a valuation lane, or SPY, which has no signed source", () => {
    for (const asset of ["BTC", "ETH", "OPENAIV", "ANTHROPICV", "SPY"] as const) expect(laneVersionsOf(asset)).toEqual([]);
  });

  it("appends: a later version in the config moves the lane and keeps the earlier ones", () => {
    const cfg = structuredClone(loadPriceSources()) as PriceSourcesFile;
    cfg.cantonVersions!.tickers!.QQQ!.push({ validFrom: "2026-10-01T00:00:00Z", validUntil: null, primary: "alpaca" });
    cfg.cantonVersions!.tickers!.QQQ![0]!.validUntil = "2026-10-01T00:00:00Z";
    const versions = equityVersions("QQQ", cfg);
    expect(versions.map((v) => v.primary)).toEqual(["pyth", "alpaca", "alpaca"]);
    expect(primarySourceAt(versions, at("2026-09-30T15:00:00Z"))).toBe("alpaca");
    expect(tokenLaneVersions({ symbol: "TSLAx", surgeSymbol: "TSLAX/USD" }, cfg).map((v) => v.primary)).toEqual(["switchboard", "jupiter"]);
  });
});
