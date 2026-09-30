import { describe, expect, it } from "vitest";
import { builtOnTally, namesLine, printedSource, type MixRow } from "./built-on";

const row = (symbol: string | null, which: number | null, source: number | null, windows: number, print_source?: string | null): MixRow => ({ symbol, which, source, windows, print_source });

describe("builtOnTally (S25: the landing lists only the sources the print mix holds)", () => {
  it("counts closes by the original source the Window's policy names, and names them in registry order", () => {
    const t = builtOnTally([
      row("BTC", 1, 4, 300, "attested:coinbase,kraken,bitstamp 1m candle close"),
      row("ETH", 1, 4, 290, "attested:coinbase,kraken,bitstamp 1m candle close"),
      row("TSLA", 1, 4, 120, "attested:redstone:TSLA"),
      row("NVDA", 1, 4, 100, "attested:redstone:NVDA"),
      row("QQQ", 1, 4, 44, "attested:alpaca:QQQ"),
      row("VOO", 1, 4, 40, "attested:alpaca:VOO"),
      row("TSLA", 1, 4, 30, "attested:jupiter:TSLAx"),
      row("OPENAI", 0, 4, 60, "attested:prestocks:OPENAI"),
      row("OPENAI", 1, 4, 58, "attested:prestocks:OPENAI"),
      row("AILABS", 1, 4, 14, "attested:basket:AILABS"),
      row("PREALL", 1, 4, 14, "attested:basket:PREALL"),
      row(null, 1, 4, 15, "attested:prestocks:OPENAI"),
      row("TSLA", 3, 4, 999, "attested:redstone:TSLA"),
    ]);
    expect(t.map((s) => s.source)).toEqual(["exchanges", "redstone", "alpaca", "jupiter", "prestocks"]);
    expect(t[0]).toEqual({ source: "exchanges", windows: 590, names: ["BTC", "ETH"], baskets: [] });
    expect(t[1]).toEqual({ source: "redstone", windows: 220, names: ["TSLA", "NVDA"], baskets: [] });
    expect(t[2]).toEqual({ source: "alpaca", windows: 84, names: ["QQQ", "VOO"], baskets: [] });
    expect(t[3]).toEqual({ source: "jupiter", windows: 30, names: ["TSLA"], baskets: [] });
    expect(t[4]).toEqual({ source: "prestocks", windows: 86, names: ["OPENAI"], baskets: ["AILABS", "PREALL"] });
  });

  it("has no Pyth column while no Window closed on Pyth, and grows one by itself when one does", () => {
    const rows = [row("TSLA", 1, 4, 10, "attested:redstone:TSLA"), row("OPENAI", 1, 4, 5, "attested:prestocks:OPENAI")];
    expect(builtOnTally(rows).map((s) => s.source)).toEqual(["redstone", "prestocks"]);
    const entitled = builtOnTally([...rows, row("OPENAIV", 1, 4, 7, "attested:pyth-index:96d4bb23")]);
    expect(entitled.map((s) => s.source)).toEqual(["redstone", "prestocks", "pyth"]);
    expect(entitled.at(-1)?.windows).toBe(7);
  });

  it("drops a source that stopped closing Windows, and lists nothing on an empty mix", () => {
    expect(builtOnTally([row("TSLA", 1, 4, 0, "attested:redstone:TSLA")])).toEqual([]);
    expect(builtOnTally([])).toEqual([]);
  });

  it("never guesses: a print with no policy text counts for PreStocks names and baskets only; a committee is not a price source", () => {
    const t = builtOnTally([row("OPENAI", 1, 4, 3, null), row("AILABS", 1, 4, 2), row("TSLA", 1, 4, 9, null), row("BTC", 1, 4, 4, "attested:committee:evt-1")]);
    expect(t).toEqual([{ source: "prestocks", windows: 5, names: ["OPENAI"], baskets: ["AILABS"] }]);
  });
});

describe("printedSource", () => {
  it("reads an attested print's policy text and nothing else", () => {
    expect(printedSource("TSLA", 4, "attested:alpaca:QQQ")).toBe("alpaca");
    expect(printedSource("TSLA", 4, "attested:pyth:16dad506")).toBe("pyth");
    expect(printedSource("TSLA", 4, "attested:switchboard:TSLAX/USD")).toBe("switchboard");
    expect(printedSource("TSLA", 4, "not a policy text")).toBeNull();
    expect(printedSource("OPENAI", 4, "not a policy text")).toBe("prestocks");
    expect(printedSource("TSLA", null, "attested:redstone:TSLA")).toBeNull();
  });
});

describe("namesLine", () => {
  it("names a pre-IPO name by its company and a listed name by its ticker", () => {
    expect(namesLine(["OPENAI"])).toBe("OpenAI");
    expect(namesLine(["TSLA", "QQQ", "VOO"])).toBe("TSLA, QQQ and VOO");
    expect(namesLine([])).toBe("");
  });

  it("shortens a long list", () => {
    expect(namesLine(["TSLA", "NVDA", "AAPL", "MSFT"], 2)).toBe("TSLA, NVDA and 2 more");
  });
});
