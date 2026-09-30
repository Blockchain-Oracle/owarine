import { describe, expect, it } from "vitest";
import { relabelView, type PartyView } from "./view";

/**
 * C4d M4: the unauthenticated view switcher (`/api/view?as=alice`) returned every row's signatories, observers and
 * payload parties verbatim, the venue's party id among them. Rows now name parties by role; the query stays literal.
 */
const VENUE = "venue::1220aaaaaaaa";
const ALICE = "alice::1220bbbbbbbb";
const SEAT = "seat-3::1220cccccccc";
const view: PartyView = {
  party: ALICE,
  request: { eventFormat: { filtersByParty: { [ALICE]: {} } } } as never,
  activeAtOffset: 9,
  total: 1,
  rows: [{ template: "Leg", contractId: "00ab", signatories: [VENUE, ALICE], observers: [SEAT, "stranger::1220dddddddd"], payload: { venue: VENUE, owner: ALICE, marketId: "BTC-1m:2", nested: [{ counterparty: SEAT }], note: "BTC::not a party" } }],
};

describe("relabelView", () => {
  it("names every party in the rows by its role, and keeps the literal query", () => {
    const out = relabelView(view, new Map([[VENUE, "venue"], [ALICE, "alice"], [SEAT, "a seat"]]));
    expect(out.rows[0]).toMatchObject({ signatories: ["venue", "alice"], observers: ["a seat", "another party"], payload: { venue: "venue", owner: "alice", marketId: "BTC-1m:2", nested: [{ counterparty: "a seat" }], note: "BTC::not a party" } });
    expect(JSON.stringify(out.rows)).not.toContain("1220");
    expect(out.party).toBe(ALICE);
    expect(out.request).toBe(view.request);
  });
});
