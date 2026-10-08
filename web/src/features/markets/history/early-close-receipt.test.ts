import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SettledRound } from "@owarine/core/projection";
import { EarlyCloseReceipt } from "./EarlyCloseReceipt";
describe("an early cash-out receipt", () => {
  it("shows actual sale proceeds and does not invent a losing settlement", () => {
    const round = { asset: "BTC", intervalSec: 300, decimals: 6, outcome: "closed", stakeBase: 540486n, proceedsBase: 503986n, feeBase: 2486n, pnlBase: -36500n, source: "wallet", sidesTraded: [0], closedAtMs: 1_791_494_000_000, entryTxHash: "12208c1ec4012900bdbd67caefccb5fa38361b538e9f9f1724672611c59cb7785011" } as SettledRound;
    const html = renderToStaticMarkup(createElement(EarlyCloseReceipt, { round, symbol: "credits" }));
    expect(html).toContain("Cash-out receipt");
    expect(html).toContain("Cash-out proceeds");
    expect(html).toContain("0.50");
    expect(html).toContain("-0.04");
    expect(html).toContain("Entry transaction");
    expect(html).toContain("Share card");
    expect(html).not.toMatch(/hazure|landing on the ledger|Closing print|Not this time/);
  });
});
