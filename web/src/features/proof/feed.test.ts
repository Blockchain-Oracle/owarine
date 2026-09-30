import { attestedPrintSource, EXCHANGE_PRINT_SOURCE } from "@agari/core/market";
import { describe, expect, it } from "vitest";
import { sourceChips, toFeed, type SettledRowWire } from "./feed";

const row = (over: Partial<SettledRowWire>): SettledRowWire => ({
  market: "M", symbol: "TSLA", cadence_sec: 300, basis: 0, state: "resolved", winner: 0, void_reason: 0, expiry_sec: "1790000000",
  prints: { "0": { source: 1, price: "38000000000" }, "1": { source: 1, price: "38100000000" } },
  ...over,
});

describe("toFeed (S25: /proof's rows)", () => {
  it("names each Window's source as every surface does, links Pyth's feed, and sorts newest first", () => {
    const feed = toFeed([
      row({ market: "A", expiry_sec: "100" }),
      row({ market: "B", symbol: "OPENAI", basis: 2, cadence_sec: 3600, expiry_sec: "300", winner: 1, prints: { "0": { source: 4, price: "1" }, "1": { source: 4, price: "2" } } }),
      row({ market: "C", symbol: "AILABS", basis: 2, cadence_sec: 3600, expiry_sec: "200", state: "voided", void_reason: 1, prints: { "0": { source: 4, price: "1" } } }),
      row({ market: "D", symbol: null }),
      row({ market: "E", state: "open" }),
    ]);
    expect(feed.map((r) => r.market)).toEqual(["B", "C", "A"]);
    expect(feed[0]).toMatchObject({ outcome: "down", sourceName: "PreStocks", sourceHref: null });
    expect(feed[1]).toMatchObject({ outcome: "void", voidReason: "missing-print", closeE8: null, sourceName: "PreStocks", sourceHref: null });
    expect(feed[2]).toMatchObject({ outcome: "up", sourceName: "Pyth", sourceHref: "https://app.pyth.com/explore/Equity.US.TSLA%2FUSD" });
  });

  it("offers a chip per source the rows hold, in a fixed order", () => {
    const feed = toFeed([row({ market: "A", prints: { "1": { source: 2, price: "1" } } }), row({ market: "B", symbol: "OPENAI", basis: 2, prints: { "1": { source: 4, price: "1" } } })]);
    expect(sourceChips(feed)).toEqual(["RedStone", "PreStocks"]);
  });

  it("C10e: names a Canton Window's attested source from its policy text, never demo data", () => {
    const attested = { "0": { source: 4, price: "1" }, "1": { source: 4, price: "2" } };
    const feed = toFeed([
      row({ market: "BTC", symbol: "BTC", expiry_sec: "400", print_source: EXCHANGE_PRINT_SOURCE, prints: attested }),
      row({ market: "QQQ", symbol: "QQQ", expiry_sec: "300", print_source: attestedPrintSource("alpaca", "QQQ"), prints: attested }),
      row({ market: "TSLAx", basis: 2, expiry_sec: "200", print_source: attestedPrintSource("jupiter", "TSLAx"), prints: attested }),
      row({ market: "TSLA", expiry_sec: "100", print_source: attestedPrintSource("redstone", "TSLA"), prints: attested }),
    ]);
    expect(feed.map((r) => r.sourceName)).toEqual(["Coinbase/Kraken/Bitstamp quorum", "Alpaca IEX", "Jupiter Price v3 median", "RedStone"]);
    expect(sourceChips(feed)).toEqual(["Coinbase/Kraken/Bitstamp quorum", "RedStone", "Alpaca IEX", "Jupiter Price v3 median"]);
  });
});
