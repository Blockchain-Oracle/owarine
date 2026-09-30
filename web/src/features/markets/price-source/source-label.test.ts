import { attestedPrintSource, EXCHANGE_PRINT_SOURCE } from "@agari/core/market";
import type { EventMarket, LaneSet } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { assetSourceLabel, printSourceName, windowSourceLabel } from "./source-label";

type W = Pick<EventMarket, "asset" | "lane" | "printSource" | "tradingStartSec">;
const w = (asset: W["asset"], lane: W["lane"], printSource: W["printSource"], tradingStartSec = 1_790_000_000): W => ({ asset, lane, printSource, tradingStartSec });
const lanes = (...markets: W[]): Pick<LaneSet, "lanes"> => ({
  lanes: markets.map((m) => ({ basis: m.lane, intervalSec: 300, label: "", nextStartSec: null, markets: [m as EventMarket] })),
});

describe("windowSourceLabel (S25: the line follows the Window's policy source)", () => {
  it("names Pyth with its Terminal page where the Window settles on Pyth, and RedStone where it settles on RedStone", () => {
    expect(windowSourceLabel(w("TSLA", "regular", "pyth"))).toEqual({ provider: "pyth", text: "Settles on Pyth · TSLA/USD", href: "https://app.pyth.com/explore/Equity.US.TSLA%2FUSD" });
    // TSLA's policy v2 (RedStone primary): the same asset, the data's source, no date in the code.
    expect(windowSourceLabel(w("TSLA", "regular", "redstone"))).toEqual({ provider: "redstone", text: "Settles on RedStone · TSLA/USD", href: null });
    expect(windowSourceLabel(w("NVDA", "gap", "redstone"))?.text).toBe("Settles on RedStone · NVDA/USD");
  });

  it("names no source a ticker cannot have", () => {
    expect(windowSourceLabel(w("VOO", "regular", "redstone"))).toBeNull();
    expect(windowSourceLabel(w("TSLA", "regular", "switchboard"))).toBeNull();
    expect(windowSourceLabel(w("TSLA", "token", "pyth"))).toBeNull();
    expect(windowSourceLabel(w("TSLA", "regular", "attested"))).toBeNull();
    // A Series whose policy was not read claims nothing (the provider no longer defaults to Pyth).
    expect(windowSourceLabel(w("TSLA", "regular", null))).toBeNull();
  });

  it("gives the xStock token lane Switchboard, a pre-IPO name its PreStocks mint (named, not linked: it lives on another chain's explorer), a basket its member count", () => {
    expect(windowSourceLabel(w("TSLA", "token", "switchboard"))?.text).toBe("Settles on Switchboard · TSLAx");
    expect(windowSourceLabel(w("OPENAI", "token", "attested"))).toEqual({
      provider: "prestocks",
      text: "Prices from PreStocks · mint Prew…rpgF",
      href: null,
    });
    expect(windowSourceLabel(w("AILABS", "token", "attested"))).toEqual({ provider: "prestocks", text: "Index of 2 PreStocks prices", href: null });
    expect(windowSourceLabel(w("PREALL", "token", "attested"))?.text).toBe("Index of 8 PreStocks prices");
    expect(windowSourceLabel(w("OPENAIV", "token", "pyth"))?.href).toBe("https://app.pyth.com/explore/Equity.Index.OPENAI%2FUSD");
  });
});

describe("assetSourceLabel (no Window in view)", () => {
  it("reads the newest stock-price Window of the asset, never the token lane's", () => {
    const set = lanes(w("TSLA", "regular", "pyth", 100), w("TSLA", "regular", "redstone", 200), w("TSLA", "token", "switchboard", 300), w("NVDA", "regular", "redstone", 400));
    expect(assetSourceLabel("TSLA", set)?.provider).toBe("redstone");
    expect(assetSourceLabel("QQQ", set)).toBeNull();
    expect(assetSourceLabel("TSLA", null)).toBeNull();
  });

  it("gives a pre-IPO name and a basket their line with no lane read", () => {
    expect(assetSourceLabel("ANTHROPIC", null)?.provider).toBe("prestocks");
    expect(assetSourceLabel("DEFSPACE", null)?.text).toBe("Index of 2 PreStocks prices");
  });
});

describe("printSourceName (one name per recorded print on every surface)", () => {
  it("names the original source an attested print's policy text reads, per lane", () => {
    expect(printSourceName("attested", "BTC", EXCHANGE_PRINT_SOURCE)).toBe("Coinbase/Kraken/Bitstamp quorum");
    expect(printSourceName("attested", "TSLA", attestedPrintSource("redstone", "TSLA"))).toBe("RedStone");
    expect(printSourceName("attested", "QQQ", attestedPrintSource("alpaca", "QQQ"))).toBe("Alpaca IEX");
    expect(printSourceName("attested", "VOO", attestedPrintSource("alpaca", "VOO"))).toBe("Alpaca IEX");
    expect(printSourceName("attested", "TSLA", attestedPrintSource("jupiter", "TSLAx"))).toBe("Jupiter Price v3 median");
    expect(printSourceName("attested", "OPENAI", attestedPrintSource("prestocks", "OPENAI"))).toBe("PreStocks");
    expect(printSourceName("attested", "AILABS", attestedPrintSource("basket", "AILABS"))).toBe("PreStocks");
  });

  it("follows the policy, not the asset: an entitled Pyth read is named Pyth, with no edit here", () => {
    expect(printSourceName("attested", "TSLA", attestedPrintSource("pyth", "16dad506"))).toBe("Pyth");
    expect(printSourceName("attested", "OPENAIV", attestedPrintSource("pyth-index", "abcd"))).toBe("Pyth index");
  });

  it("never calls a price demo data: without the policy text a PreStocks asset is PreStocks, anything else only attested", () => {
    for (const text of [undefined, null, "", "not a policy"]) {
      expect(printSourceName("attested", "OPENAI", text)).toBe("PreStocks");
      expect(printSourceName("attested", "AILABS", text)).toBe("PreStocks");
      expect(printSourceName("attested", "TSLA", text)).toBe("Oracle-attested");
      expect(printSourceName("attested", null, text)).toBe("Oracle-attested");
    }
    for (const asset of ["TSLA", "BTC", "QQQ", "OPENAI", null]) expect(printSourceName("attested", asset).toLowerCase()).not.toContain("demo");
  });

  it("keeps a directly signed print's own name", () => {
    expect(printSourceName("pyth", "TSLA")).toBe("Pyth");
    expect(printSourceName("redstone", null)).toBe("RedStone");
  });
});
