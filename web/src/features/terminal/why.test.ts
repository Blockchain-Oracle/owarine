import { describe, expect, it } from "vitest";
import type { MarketSession } from "@/features/markets/session";
import { shortWhy, WHY, whyNotTrading } from "./why";

const session = (open: boolean, lanes: Record<string, string>): MarketSession => ({ open, label: "Opens Fri 09:30 ET", lanes }) as unknown as MarketSession;

describe("whyNotTrading", () => {
  it("says nothing while the round trades", () => {
    expect(whyNotTrading("trading", "BTC", session(false, {}))).toBeNull();
  });

  it("names the closed US market for a stock", () => {
    expect(whyNotTrading("none", "AAPL", session(false, { "AAPL-15m": "paused: traffic (core lanes only)" }))).toBe(WHY.stockClosed("Opens Fri 09:30 ET"));
  });

  it("blames the network when rounds wait on a price while DevNet refuses traffic", () => {
    const s = session(false, { "BTC-2m": "open #83 21:10–21:12Z v1 attested", "AAPL-15m": "paused: traffic (core lanes only)" });
    expect(whyNotTrading("pricing", "BTC", s)).toBe(WHY.networkBusy);
  });

  it("names a price provider that is down", () => {
    const s = session(false, { "CC-2m": "paused: no signed source (RedStone gateways failed (HTTP 403))", "CC-5m": "paused: no signed source (RedStone)" });
    expect(whyNotTrading("none", "CC", s)).toBe(WHY.noSource);
    expect(shortWhy("CC", s)).toBe(WHY.short.noSource);
  });

  it("identifies delayed market data when ops has opened a round that the app cannot read", () => {
    const s = session(false, { "BTC-2m": "open #1142 07:18–07:20Z v1 attested" });
    expect(whyNotTrading("none", "BTC", s)).toBe(WHY.indexDelayed);
    expect(shortWhy("BTC", s)).toBe(WHY.short.indexDelayed);
  });

  it("falls back to the round's own state", () => {
    expect(whyNotTrading("next", "ETH", session(true, { "ETH-2m": "open #1" }))).toBe(WHY.next);
  });
});
