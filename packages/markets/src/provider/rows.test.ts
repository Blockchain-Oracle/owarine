import { groupIntoLanes, isCommitteeMarket } from "@owarine/core/market";
import { phase } from "@owarine/core/lifecycle";
import type { Address } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import type { VenueFacts } from "../runtime/accounts";
import type { MarketRow } from "./index-api";
import { isEventRow, isListable, toEventMarket } from "./rows";

const venue = { config: "venue" as Address, collateralMint: "cash" as Address, decimals: 6, treasury: "t" as Address, mode: 0, programSeats: [] } as unknown as VenueFacts;
const START = 1_790_694_000;

const row = (o: Partial<MarketRow>): MarketRow =>
  ({
    market: "m1", series: "s1", symbol: "TSLA", basis: 0, cadence_sec: 300, book: "terms-1", market_index: "3", trading_start_sec: String(START), lock_at_sec: String(START + 270),
    expiry_sec: String(START + 300), state: "open", winner: null, policy_version: 1, prints: null, void_reason: null, single_source: null, resolved_ts_sec: null, resolved_signature: null,
    backing_lots: "0", volume_ticklots: "0", trade_count: "0", last_price_ticks: null, lot_base: null, tick_base: "1", cash_unit: "1000", ...o,
  }) as unknown as MarketRow;

describe("committee events in the market list (C6e, K-070)", () => {
  const event = row({ market: "e1", symbol: "EVT-DEMO-1", cadence_sec: 600, lock_at_sec: String(START + 540), expiry_sec: String(START + 600), event_question: "Will the committee attest YES?" });

  it("an event row is not a lane row but lists as an event: its question, 24/7, kind event", () => {
    expect(isListable(event)).toBe(false);
    expect(isEventRow(event)).toBe(true);
    expect(isEventRow(row({}))).toBe(false);
    const m = toEventMarket(event, venue, null, START + 10);
    expect(m).toMatchObject({ kind: "event", lane: "token", question: "Will the committee attest YES?", asset: "EVT-DEMO-1", status: "Trading" });
    expect(isCommitteeMarket(m)).toBe(true);
    // No opening print, still enterable: the ticket is not held on "pending opening print".
    expect(phase(m, (START + 10) * 1000)).toBe("trading");
    const price = toEventMarket(row({}), venue, null, START + 10);
    expect(price.kind).toBe("price");
    expect(phase(price, (START + 10) * 1000)).toBe("pendingOpeningPrint");
  });

  it("never lands in a cadence lane", () => {
    const markets = [toEventMarket(row({}), venue, null, START), toEventMarket(event, venue, null, START)];
    const lanes = groupIntoLanes(markets.filter((m) => !isCommitteeMarket(m)), venue.config);
    expect(lanes.lanes.flatMap((l) => l.markets.map((m) => m.asset))).toEqual(["TSLA"]);
  });
});
