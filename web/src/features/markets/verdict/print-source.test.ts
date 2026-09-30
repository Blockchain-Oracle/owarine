import { attestedPrintSource, EXCHANGE_PRINT_SOURCE } from "@agari/core/market";
import { describe, expect, it } from "vitest";
import { buildTradeTweetText, type TradeCard } from "@/features/share/trade-card";
import { printSourceText } from "./print-source";

/** 2026-09-29 20:00:00 UTC = 16:00:00 ET. */
const T = 1_790_712_000;

describe("printSourceText (C10e: every verdict names the source its Window's policy attested)", () => {
  it("names the lane's real source, not a demo label", () => {
    expect(printSourceText({ printSource: "attested", printSourceText: EXCHANGE_PRINT_SOURCE, singleSource: false }, T, "BTC")).toBe("Coinbase/Kraken/Bitstamp quorum price at 16:00:00 ET");
    expect(printSourceText({ printSource: "attested", printSourceText: attestedPrintSource("alpaca", "QQQ"), singleSource: false }, T, "QQQ")).toBe("Alpaca IEX price at 16:00:00 ET");
    expect(printSourceText({ printSource: "attested", printSourceText: attestedPrintSource("jupiter", "TSLAx"), singleSource: false }, T, "TSLA")).toBe("Jupiter Price v3 median price at 16:00:00 ET");
    expect(printSourceText({ printSource: "attested", printSourceText: attestedPrintSource("redstone", "NVDA"), singleSource: true }, null, "NVDA")).toBe("RedStone · single source");
  });

  it("says only 'Oracle-attested' when the policy text was not read, and nothing before settlement", () => {
    expect(printSourceText({ printSource: "attested", singleSource: false }, T, "TSLA")).toBe("Oracle-attested price at 16:00:00 ET");
    expect(printSourceText({ printSource: "attested", printSourceText: null, singleSource: false }, T, "OPENAI")).toBe("PreStocks price at 16:00:00 ET");
    expect(printSourceText({ printSource: null, singleSource: false }, T, "TSLA")).toBeNull();
    expect(printSourceText(null, T, "TSLA")).toBeNull();
  });
});

describe("the share card's print line names the same source", () => {
  const card: TradeCard = {
    asset: "QQQ", intervalSec: 3_600, sides: ["up"], outcome: "win", lineRaw: 51_000_000_000n, closeRaw: 51_240_000_000n, stakeBase: 5_000_000n,
    payoutBase: 9_000_000n, pnlBase: 4_000_000n, decimals: 6, symbol: "credits", expirySec: T, settledAtMs: T * 1000, entryTxHash: null,
    settlementTxHash: null, printSource: "attested", printSourceText: attestedPrintSource("alpaca", "QQQ"), singleSource: false, voidReason: null,
  };

  it("posts the attested source by name", () => {
    const text = buildTradeTweetText(card);
    expect(text).toContain("alpaca iex print");
    expect(text.toLowerCase()).not.toContain("demo price");
    expect(text.toLowerCase()).not.toContain("attested demo");
  });
});
