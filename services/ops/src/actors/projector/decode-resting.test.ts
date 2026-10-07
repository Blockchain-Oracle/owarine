import type { IdxFact } from "@owarine/db";
import type { JsTransaction } from "@owarine/ledger";
import { describe, expect, it } from "vitest";
import { decodeTransaction } from "./decode";

/**
 * The pre-open resting call (abu-pm-main 0.5.1, K-235) as the venue sees it in LEDGER_EFFECTS, built by hand from the
 * shapes the choices in `PM/Resting.daml` produce (the exercise first, then its created and archived children).
 */
const V = "venue::1220";
const ALICE = "alice::1220";
const T = 1_790_000_000;
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const PKG = "abu-pm-main";
const at = { offset: 9, packageName: PKG, witnessParties: [V], "createdAt": "" };

const callArg = (over: Record<string, unknown> = {}) => ({
  venue: V, owner: ALICE, callRef: "rc-1", termsCid: "00terms", marketId: "TSLA-5m:7", side: "SideUp", priceTicks: "550", lotsPlaced: "10", lots: "10", cashUnit: "1000", escrow: "5500000",
  "tradingStart": iso(T + 300), lockAt: iso(T + 540), refundAfter: iso(T + 1_300), expiresAt: iso(T + 390), ...over,
});
const legArg = (owner: string, outcome: string, lots: string, backing: string) => ({
  venue: V, owner, termsCid: "00terms", marketId: "TSLA-5m:7", pairId: "rc-1#0", outcome, lots, cashUnit: "1000", backingShare: backing, feePaid: "0", refundAfter: iso(T + 1_300), beneficiaryRef: null, bookCost: null,
});
const created = (nodeId: number, contractId: string, template: string, createArgument: unknown) => ({ CreatedEvent: { ...at, nodeId, contractId, templateId: `pkg:${template}`, createArgument, signatories: [V] } });
const exercised = (nodeId: number, lastDescendantNodeId: number, contractId: string, template: string, choice: string, choiceArgument: unknown = {}) => ({
  ExercisedEvent: { ...at, nodeId, lastDescendantNodeId, contractId, templateId: `pkg:${template}`, choice, choiceArgument, consuming: true, actingParties: [ALICE], exerciseResult: null },
});
const archived = (nodeId: number, contractId: string, template: string) => ({ ArchivedEvent: { ...at, nodeId, contractId, templateId: `pkg:${template}` } });
const tx = (updateId: string, events: unknown[]): JsTransaction => ({ updateId, offset: 9, effectiveAt: iso(T + 310), synchronizerId: "sync", recordTime: iso(T + 310), commandId: "c", workflowId: "", events } as unknown as JsTransaction);
const kinds = <K extends IdxFact["kind"]>(facts: IdxFact[], kind: K) => facts.filter((f): f is Extract<IdxFact, { kind: K }> => f.kind === kind);
const facts = (t: JsTransaction) => decodeTransaction(t).facts;

describe("a resting call in the projection", () => {
  it("RestOffer_Place: a call was placed, and the offer's own consumption makes no fact", () => {
    const fs = facts(
      tx("u1", [
        exercised(0, 3, "offer1", "PM.Resting:RestingOffer", "RestOffer_Place", { cash: ["cash1"] }),
        archived(1, "cash1", "PM.Money:VenueCash"),
        created(2, "call1", "PM.Resting:RestingCall", callArg()),
        created(3, "change1", "PM.Money:VenueCash", { venue: V, owner: ALICE, amount: "500", bucket: "change" }),
      ]),
    );
    expect(kinds(fs, "rest-call")).toEqual([
      {
        kind: "rest-call", contractId: "call1", callRef: "rc-1", user: ALICE, termsCid: "00terms", marketKey: "TSLA-5m:7", side: 0, priceTicks: 550, lotsPlaced: "10", lots: "10", cashUnit: "1000",
        escrow: "5500000", tradingStartSec: T + 300, expiresAtSec: T + 390, placed: true,
      },
    ]);
    expect(kinds(fs, "rest-closed")).toHaveLength(0);
  });

  it("Rest_Fill of the whole call: the call closes filled, the user's leg is an accept-origin position keyed by the fill's node", () => {
    const fs = facts(
      tx("u2", [
        exercised(0, 4, "call1", "PM.Resting:RestingCall", "Rest_Fill", { shardCid: "shard1", fillLots: "10" }),
        archived(1, "shard1", "PM.Money:VenueCash"),
        created(2, "leg-u", "PM.Leg:Leg", legArg(ALICE, "SideUp", "10", "5500000")),
        created(3, "leg-v", "PM.Leg:Leg", legArg(V, "SideDown", "10", "4500000")),
      ]),
    );
    expect(kinds(fs, "rest-closed")).toEqual([{ kind: "rest-closed", contractId: "call1", how: "filled", refundedBase: "0" }]);
    const legs = kinds(fs, "leg");
    const user = legs.find((l) => l.owner === ALICE)!;
    expect(user).toMatchObject({ origin: "accept", resting: true, acceptNodeId: 0, quoteCid: "call1", backingShare: "5500000", feePaid: "0", outcome: 0 });
    expect(legs.find((l) => l.owner === V)).toMatchObject({ origin: "accept", resting: true, outcome: 1, backingShare: "4500000" });
  });

  it("a partial Rest_Fill closes nothing: the remainder the fill re-created moves the call on, under the same reference", () => {
    const fs = facts(
      tx("u3", [
        exercised(0, 5, "call1", "PM.Resting:RestingCall", "Rest_Fill", { shardCid: "shard1", fillLots: "4" }),
        archived(1, "shard1", "PM.Money:VenueCash"),
        created(2, "leg-u", "PM.Leg:Leg", legArg(ALICE, "SideUp", "4", "2200000")),
        created(3, "leg-v", "PM.Leg:Leg", legArg(V, "SideDown", "4", "1800000")),
        created(4, "call2", "PM.Resting:RestingCall", callArg({ lots: "6", escrow: "3300000" })),
        created(5, "change1", "PM.Money:VenueCash", { venue: V, owner: V, amount: "10", bucket: "shard" }),
      ]),
    );
    expect(kinds(fs, "rest-closed")).toHaveLength(0);
    expect(kinds(fs, "rest-call")).toEqual([expect.objectContaining({ contractId: "call2", callRef: "rc-1", lots: "6", lotsPlaced: "10", escrow: "3300000", placed: false })]);
  });

  it("Rest_Cancel and Rest_Expire close the call with the refund that came back as venue credit", () => {
    const refund = created(1, "refund1", "PM.Money:VenueCash", { venue: V, owner: ALICE, amount: "3300000", bucket: "resting-refund" });
    expect(kinds(facts(tx("u4", [exercised(0, 1, "call2", "PM.Resting:RestingCall", "Rest_Cancel"), refund])), "rest-closed")).toEqual([
      { kind: "rest-closed", contractId: "call2", how: "cancelled", refundedBase: "3300000" },
    ]);
    expect(kinds(facts(tx("u5", [exercised(0, 1, "call2", "PM.Resting:RestingCall", "Rest_Expire"), refund])), "rest-closed")).toEqual([
      { kind: "rest-closed", contractId: "call2", how: "expired", refundedBase: "3300000" },
    ]);
  });

  it("a call seen only in the ACS bootstrap (no placing exercise) still creates its row", () => {
    const fs = decodeTransaction(tx("u6", [created(0, "call9", "PM.Resting:RestingCall", callArg({ callRef: "rc-9" }))]), { snapshot: true }).facts;
    expect(kinds(fs, "rest-call")[0]).toMatchObject({ callRef: "rc-9", placed: true });
  });

  it("an ordinary accept is unchanged: not a resting fill", () => {
    const fs = facts(
      tx("u7", [
        exercised(0, 2, "quote1", "PM.Quote:Quote", "Quote_Accept", { cash: ["c"], beneficiaryRef: null }),
        created(1, "leg-u", "PM.Leg:Leg", legArg(ALICE, "SideUp", "1", "600")),
        created(2, "leg-v", "PM.Leg:Leg", legArg(V, "SideDown", "1", "400")),
      ]),
    );
    const user = kinds(fs, "leg").find((l) => l.owner === ALICE)!;
    expect(user).toMatchObject({ origin: "accept", quoteCid: "quote1" });
    expect(user.resting).toBeUndefined();
  });
});
