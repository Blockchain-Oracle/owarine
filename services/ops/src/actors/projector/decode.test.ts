import { readFileSync } from "node:fs";
import type { IdxFact } from "@agari/db";
import type { JsTransaction } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { decodeTransaction, isoSec, templateName } from "./decode";

/**
 * Real LEDGER_EFFECTS transactions as the venue saw them on a local Canton 3.5.17 sandbox running abu-pm-main 0.2.0
 * (C3a scenario, 29 Sep; party ids shortened to `<name>::1220`). CASH_UNIT 1000.
 */
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/lifecycle.json", import.meta.url), "utf8")) as Record<string, JsTransaction>;
const facts = (name: string): IdxFact[] => decodeTransaction(fixtures[name]!).facts;
const ofKind = <K extends IdxFact["kind"]>(fs: IdxFact[], kind: K) => fs.filter((f): f is Extract<IdxFact, { kind: K }> => f.kind === kind);

describe("decode helpers", () => {
  it("strips the package id or name from a template id", () => {
    expect(templateName("2359d138:PM.Leg:Leg")).toBe("PM.Leg:Leg");
    expect(templateName("#abu-pm-main:PM.Quote:Quote")).toBe("PM.Quote:Quote");
  });
  it("reads ledger times at any fractional precision, floored to the second", () => {
    expect(isoSec("2026-09-29T03:24:29.999999Z")).toBe(Date.UTC(2026, 8, 29, 3, 24, 29) / 1000);
    expect(isoSec("2026-09-29T03:24:29Z")).toBe(Date.UTC(2026, 8, 29, 3, 24, 29) / 1000);
    expect(() => isoSec("yesterday")).toThrow();
  });
});

describe("decodeTransaction on real venue transactions", () => {
  it("every fixture keeps its update id, offset and one raw event per node", () => {
    for (const tx of Object.values(fixtures)) {
      const u = decodeTransaction(tx);
      expect(u.updateId).toBe(tx.updateId);
      expect(u.offset).toBe(tx.offset);
      expect(u.events.map((e) => e.nodeId)).toEqual(tx.events.map((e) => (Object.values(e)[0] as { nodeId: number }).nodeId).sort((a, b) => a - b));
    }
  });

  it("Series_OpenWindow: the next Series, the Window's terms and its single-use state", () => {
    const fs = facts("open-window");
    expect(ofKind(fs, "series")).toHaveLength(1);
    const [w] = ofKind(fs, "window-opened");
    expect(w).toMatchObject({ index: 0, symbol: "BTC", cashUnit: "1000", quorum: 2, policyVersion: 1, tieUp: true });
    expect(w!.expirySec - w!.tradingStartSec).toBe(40);
    expect(w!.marketKey).toMatch(/^BTC-c3a-.+:0$/);
    expect(ofKind(fs, "window-state")[0]).toMatchObject({ live: true, termsCid: w!.termsCid });
  });

  it("an oracle's print command: one PriceQuote per symbol", () => {
    const prices = ofKind(facts("print"), "price");
    expect(prices.map((p) => p.symbol).sort()).toEqual(["BTC", "ETH", "SOL"]);
    for (const p of prices) expect(p.fetchedAtSec - p.boundarySec).toBe(2);
  });

  it("Terms_RecordOpen consumes the state and records the quorum median", () => {
    const fs = facts("record-open");
    expect(ofKind(fs, "window-state")[0]).toMatchObject({ live: false });
    expect(ofKind(fs, "open-print")[0]).toMatchObject({ openPriceE8: "6000100000000", signers: 3 });
  });

  it("Quote_Accept: the quote closes accepted, the user's leg carries the accept node and quote, the venue's the other side", () => {
    const fs = facts("accept");
    expect(ofKind(fs, "quote-closed")[0]).toMatchObject({ how: "accepted" });
    const legs = ofKind(fs, "leg");
    const user = legs.find((l) => l.owner.startsWith("alice"))!;
    const venue = legs.find((l) => l.owner.startsWith("venue"))!;
    expect(user).toMatchObject({ origin: "accept", outcome: 0, lots: "10", backingShare: "6000000", feePaid: "5" });
    expect(user.acceptNodeId).not.toBeNull();
    expect(user.quoteCid).toBe(ofKind(fs, "quote-closed")[0]!.contractId);
    expect(venue).toMatchObject({ outcome: 1, backingShare: "4000000", feePaid: "0" });
  });

  it("BuyQuote_Accept: a sale at 500 ticks, the user's leg closes as sold with its fee recognised, the venue takes the leg", () => {
    const fs = facts("buyback");
    expect(ofKind(fs, "sale")[0]).toMatchObject({ priceTicks: 500, saleBase: "2500000" });
    expect(ofKind(fs, "leg-closed")[0]).toMatchObject({ how: "sold", paidBase: "2500000", feeBase: "3" });
    expect(ofKind(fs, "leg")[0]).toMatchObject({ origin: "buyback", owner: expect.stringMatching(/^venue/), feePaid: "0" });
    expect(ofKind(fs, "sale")[0]!.legCid).toBe(ofKind(fs, "leg-closed")[0]!.contractId);
  });

  it("Leg_Merge: both venue legs close merged; the exercised one carries the netting release", () => {
    const closed = ofKind(facts("merge"), "leg-closed");
    expect(closed.map((c) => c.how)).toEqual(["merged", "merged"]);
    expect(closed.map((c) => c.paidBase).sort()).toEqual(["0", "10000000"]);
  });

  it("Terms_Resolve: Up with both prices, or void on source disagreement", () => {
    const up = ofKind(facts("resolve-up"), "resolution")[0]!;
    expect(up).toMatchObject({ outcome: 0, voidDetail: null, openPriceE8: "6000100000000", closePriceE8: "6010100000000", signers: 3 });
    // The disclosure fields ride along: the fixture was fetched without blobs, the live stream asks for them.
    expect(up.templateId).toMatch(/:PM\.Market:Resolution$/);
    expect(up.createdEventBlob).toBeNull();
    expect(up.synchronizerId).toBe(fixtures["resolve-up"]!.synchronizerId);
    expect(up.createdAtMs).toBeGreaterThan(0);
    const fsVoid = facts("resolve-void");
    expect(ofKind(fsVoid, "resolution")[0]).toMatchObject({ outcome: null, voidDetail: "SourceDisagreement:CloseSlot", closePriceE8: null });
    expect(ofKind(fsVoid, "open-print-consumed")).toHaveLength(1);
  });

  it("Desk_SettleBatch: each leg settles with its payout and fee from the cash its own subtree created", () => {
    const a = ofKind(facts("settle-a"), "leg-closed");
    expect(a).toHaveLength(4);
    expect(a.every((c) => c.how === "settled" && c.resolutionCid !== null)).toBe(true);
    expect(a.map((c) => `${c.paidBase}/${c.feeBase}`).sort()).toEqual(["0/0", "0/5", "10000000/5", "5000000/0"]);
    const v = ofKind(facts("settle-void"), "leg-closed");
    expect(v.map((c) => `${c.paidBase}/${c.feeBase}`).sort()).toEqual(["10000000/0", "10000000/0", "10000010/0", "10000010/0"]);
  });

  it("Leg_RefundStale: the owner takes backing plus fee back, with no resolution", () => {
    expect(ofKind(facts("refund-stale"), "leg-closed")[0]).toMatchObject({ how: "refunded_stale", paidBase: "2100002", feeBase: "0", resolutionCid: null });
  });

  it("publication, retraction, expiry and withdrawal", () => {
    expect(ofKind(facts("publish"), "publication")[0]).toMatchObject({ handle: "alice", outcome: 0, lots: "10", backingShare: "6000000" });
    expect(ofKind(facts("retract"), "publication-archived")).toHaveLength(1);
    expect(ofKind(facts("expire"), "quote-closed")[0]).toMatchObject({ how: "expired" });
    expect(ofKind(facts("withdraw"), "quote-closed")[0]).toMatchObject({ how: "withdrawn" });
  });

  it("an ACS snapshot decodes legs as origin snapshot, with no fill", () => {
    const u = decodeTransaction(fixtures.accept!, { snapshot: true });
    expect(ofKind(u.facts, "leg").every((l) => l.origin === "snapshot" && l.acceptNodeId === null)).toBe(true);
  });
});
