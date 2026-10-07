import { describe, expect, it } from "vitest";
import { privateRequestId } from "@owarine/core/private";
import { toSnapshot } from "./reads";

const createdAt = "2026-10-06T07:50:00Z";
const cash = (cid: string, amount: string, bucket: string, owner = "seat") => ({
  createdEvent: { offset: 9, nodeId: 0, contractId: cid, templateId: "pkg:PM.Money:VenueCash", packageName: "abu-pm-main", witnessParties: ["seat"], signatories: ["venue", "seat"], createdAt, createArgument: { venue: "venue", owner, amount, bucket } },
});
const leg = (cid: string, beneficiaryRef: string | null) => ({
  createdEvent: {
    offset: 9, nodeId: 0, contractId: cid, templateId: "pkg:PM.Leg:Leg", packageName: "abu-pm-main", witnessParties: ["seat"], signatories: ["venue", "seat"], createdAt,
    createArgument: { venue: "venue", owner: "seat", termsCid: "00terms", marketId: "BTC-5m:73", pairId: cid, outcome: "SideUp", lots: "10", cashUnit: "1000", backingShare: "4500000", feePaid: "200000", refundAfter: "2026-10-06T08:15:00Z", beneficiaryRef },
  },
});

describe("L-39 on Canton: the private bucket and private calls stay out of the seat's public money (C8d)", () => {
  it("never counts private cash as spendable, and keeps private legs out of the public positions", () => {
    const snap = toSnapshot("seat", [cash("00a", "980000000", "demo"), cash("00b", "15300000", "private"), cash("00c", "5", "payout"), cash("00x", "7", "private", "other"), leg("00l1", null), leg("00l2", "private")] as never, 9);
    expect(snap.cash.map((c) => c.cid)).toEqual(["00a", "00c"]);
    expect(snap.privateCash?.map((c) => [c.cid, c.amount])).toEqual([["00b", 15_300_000n]]);
    expect(snap.legs.map((l) => l.cid)).toEqual(["00l1"]);
    expect(snap.privateLegs?.map((l) => [l.cid, l.ref])).toEqual([["00l2", "private"]]);
  });

  it("a request id is always a v4 UUID, with or without crypto.randomUUID", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(privateRequestId()).toMatch(re);
    const real = globalThis.crypto.randomUUID;
    try {
      (globalThis.crypto as { randomUUID?: unknown }).randomUUID = undefined;
      expect(privateRequestId()).toMatch(re);
    } finally {
      (globalThis.crypto as { randomUUID?: unknown }).randomUUID = real;
    }
  });
});
