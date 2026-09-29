import { describe, expect, it } from "vitest";
import { decodeSettlementReceipt } from "../ops/tickets/receipt";
import { ticketReceiptViewWire } from "../provider/ticket-wire";
import { appMarketId } from "./ids";
import { receiptViews, type MarketFacts, type ReceiptRow } from "./tickets-receipts";

const venue = "venue::1220aa";
const alice = "alice::1220bb";
// A receipt as the JSON Ledger API v2 renders it: Int as a string, Optional as the value or null.
const json = (o: Record<string, unknown> = {}, detail: Record<string, unknown> = {}) => ({
  venue, owner: alice, marketId: "BTC-1m:2", pairId: "", outcome: "SideDown", resolved: "SideUp", lots: "1", cashUnit: "1", backingShare: "200",
  cost: "200", payout: "0", fee: "0", product: "parlay",
  detail: { reserveId: "parlay", marketIds: ["BTC-1m:1", "BTC-1m:2", "ETH-1m:3"], pick: "Up,Down,Up", stake: "200", toReserve: "1000", result: "lost", ...detail },
  ...o,
});
const facts = (termsCid: string, outcome: "SideUp" | "SideDown" | null): MarketFacts => ({ termsCid, resolutionCid: `r-${termsCid}`, outcome, openE8: 100n, closeE8: outcome ? 101n : null, disclosure: null });
const byMarket = new Map([["BTC-1m:1", facts("t1", "SideUp")], ["BTC-1m:2", facts("t2", "SideUp")], ["ETH-1m:3", facts("t3", "SideDown")]]);
const expiries: Record<string, number> = { t1: 60, t2: 120, t3: 180 };
const expiryOf = async (t: string) => expiries[t] ?? null;
const row = (v: unknown, createdAtSec: number, cid = `00${"ef".repeat(34)}`): ReceiptRow => ({ cid, data: decodeSettlementReceipt(v), createdAtSec });

describe("settlement receipts", () => {
  it("decodes a ticket receipt and a pair leg's", () => {
    const r = decodeSettlementReceipt(json());
    expect(r).toMatchObject({ outcome: "SideDown", resolved: "SideUp", backingShare: 200n, product: "parlay" });
    expect(r.detail).toEqual({ reserveId: "parlay", marketIds: ["BTC-1m:1", "BTC-1m:2", "ETH-1m:3"], pick: "Up,Down,Up", stake: 200n, toReserve: 1000n, result: "lost" });
    expect(decodeSettlementReceipt(json({ product: null, detail: null, resolved: null }))).toMatchObject({ product: null, detail: null, resolved: null });
  });

  it("a lost parlay: legs before the deciding one won, the rest never decided", async () => {
    const [v] = await receiptViews([row(json(), 500)], byMarket, expiryOf);
    expect(v).toMatchObject({ product: "parlay", result: "lost", settledAtSec: 500, marketId: appMarketId("BTC-1m:2"), side: "down", resolved: "up", expirySec: 120, openingPrint: 100n, closingPrint: 101n });
    expect(v!.legs.map((l) => [l.side, l.expirySec, l.resolved])).toEqual([["up", 60, "won"], ["down", 120, "lost"], ["up", 180, "pending"]]);
    expect(ticketReceiptViewWire.parse(JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))))).toEqual(v);
  });

  it("a won parlay has every leg won; a stale void names the first undecided leg", async () => {
    const [won] = await receiptViews([row(json({ marketId: "ETH-1m:3", payout: "1000" }, { toReserve: "0", result: "won" }), 1)], byMarket, expiryOf);
    expect(won!.legs.every((l) => l.resolved === "won")).toBe(true);
    const [stale] = await receiptViews([row(json({ resolved: null, payout: "200" }, { toReserve: "800", result: "void" }), 1)], new Map([["BTC-1m:1", facts("t1", "SideUp")]]), expiryOf);
    expect(stale!.legs.map((l) => l.resolved)).toEqual(["won", "void", "pending"]);
    // without its terms the expiry is 0, never guessed; the screens read the market for it
    expect(stale!.expirySec).toBe(0);
  });

  it("lists newest first, and leaves out a result this build does not know", async () => {
    const boost = json({ product: "boost", marketId: "BTC-1m:1", outcome: "SideUp", lots: "4", backingShare: "2000", cost: "1026", payout: "75", fee: "51" }, { pick: "Up @20000bps", marketIds: ["BTC-1m:1"], stake: "1026", toReserve: "1076", result: "knocked-out" });
    const views = await receiptViews([row(json(), 10, `00${"01".repeat(34)}`), row(boost, 20, `00${"02".repeat(34)}`), row(json({}, { result: "halved" }), 30)], byMarket, expiryOf);
    expect(views.map((v) => [v.product, v.result])).toEqual([["boost", "knocked-out"], ["parlay", "lost"]]);
  });
});
