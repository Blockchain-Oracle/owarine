import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLOCK, fixtureSession } from "@/app/dev/session/market-session-fixtures";
import { MarketSessionChipView } from "./MarketSessionChip";
vi.mock("@/lib/when", () => ({ useSessionPhrase: () => () => "After hours · reopens tomorrow" }));
vi.mock("@owarine/markets/react", async (original) => ({ ...await original<object>(), useTick: () => undefined }));
const render = (asset: string, halt = false) => renderToStaticMarkup(createElement(MarketSessionChipView, {
  asset, nowSec: CLOCK.postTue,
  session: fixtureSession(CLOCK.postTue, { asset, halts: halt ? { [asset]: { reason: "prestocks-stale", sinceSec: CLOCK.postTue - 60 } } : {} }),
}));
describe("market hours belong to the selected asset", () => {
  it("labels BTC, xStocks and pre-IPO markets as 24/7 after stock hours", () => {
    for (const asset of ["BTC", "TSLAx", "OPENAI"]) {
      expect(render(asset)).toContain("24/7 market");
      expect(render(asset)).not.toContain("After hours");
    }
  });
  it("keeps real stock hours, and a 24/7 asset's actual halt", () => {
    expect(render("AAPL")).toContain("After hours");
    expect(render("OPENAI", true)).toContain("Signed price stale");
    expect(render("OPENAI", true)).not.toContain("24/7 market");
  });
});
