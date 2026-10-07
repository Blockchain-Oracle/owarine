import { describe, expect, it, vi } from "vitest";
import { errorFromResponse, type JsTransaction, type LedgerClient } from "@owarine/ledger";
import type { RestingCallView, RestingOfferView } from "./contracts";
import { appMarketId } from "./ids";
import { busyUntilMs } from "./map";
import type { MarketReader, SeatReader, SeatSnapshot } from "./reads";
import { classifyRejection } from "./rejection";
import { createRestWriter, restedFrom } from "./rest-writes";
import { seatCommandKit, type CommandJournal, type CommandRow } from "./writes";

const V = "venue::1220abcdef";
const SEAT = "seat-1::1220cdef01";
const DAML_ID = "TSLA-5m:7";
const MARKET = appMarketId(DAML_ID);
const T = Date.parse("2026-10-01T12:00:00Z");
const JOURNAL_ID = "11111111-1111-4111-8111-111111111111";
const actor = { party: SEAT, leaseId: "lease-1" };
const iso = (ms: number) => new Date(ms).toISOString();

const offer = (o: Partial<RestingOfferView> = {}): RestingOfferView => ({
  cid: "00ee01", callRef: "rc-1", damlMarketId: DAML_ID, marketId: MARKET, termsCid: "00terms", side: "up", lots: 10n, priceTicks: 550n, cashUnit: 1000n,
  tradingStartMs: T + 300_000, lockAtMs: T + 540_000, expiresAtMs: T + 390_000, validUntilMs: T + 30_000, ...o,
});
const call = (o: Partial<RestingCallView> = {}): RestingCallView => ({
  cid: "00ca11", callRef: "rc-1", damlMarketId: DAML_ID, marketId: MARKET, termsCid: "00terms", side: "up", priceTicks: 550n, lotsPlaced: 10n, lots: 10n, cashUnit: 1000n, escrow: 5_500_000n,
  tradingStartMs: T + 300_000, lockAtMs: T + 540_000, expiresAtMs: T + 390_000, ...o,
});

const callEvent = (side: "SideUp" | "SideDown", priceTicks: string) => ({
  CreatedEvent: {
    contractId: "00ca99", templateId: "pkg:PM.Resting:RestingCall", offset: 9, nodeId: 3, packageName: "abu-pm-main", witnessParties: [SEAT], signatories: [V, SEAT], "createdAt": iso(T),
    createArgument: {
      venue: V, owner: SEAT, callRef: "rc-1", termsCid: "00terms", marketId: DAML_ID, side, priceTicks, lotsPlaced: "10", lots: "10", cashUnit: "1000", escrow: String(10n * BigInt(priceTicks) * 1000n),
      "tradingStart": iso(T + 300_000), lockAt: iso(T + 540_000), refundAfter: iso(T + 1_300_000), expiresAt: iso(T + 390_000),
    },
  },
});
const cashEvent = (amount: string) => ({
  CreatedEvent: { contractId: "00refund", templateId: "pkg:PM.Money:VenueCash", offset: 9, nodeId: 1, packageName: "abu-pm-main", witnessParties: [SEAT], signatories: [V, SEAT], "createdAt": iso(T), createArgument: { venue: V, owner: SEAT, amount, bucket: "resting-refund" } },
});
const tx = (events: unknown[]): JsTransaction => ({ updateId: "1220" + "ab".repeat(32), offset: 9, effectiveAt: iso(T), synchronizerId: "s", recordTime: iso(T), commandId: "x", workflowId: "", events } as unknown as JsTransaction);

function setup(snap: Partial<SeatSnapshot>, outcome: () => JsTransaction | Error) {
  const full: SeatSnapshot = { party: SEAT, offset: 8, cash: [], legs: [], quotes: [], buyQuotes: [], restingOffers: [], restingCalls: [], ...snap };
  const seats: SeatReader = { read: vi.fn(async () => full), invalidate: () => undefined };
  const markets: MarketReader = { terms: async () => null, resolutions: async () => new Map() };
  const store = new Map<string, CommandRow>();
  const journal: CommandJournal = {
    begin: async (row, nowMs) => {
      if (!store.has(row.commandId)) store.set(row.commandId, { ...row, state: "pending", updateId: null, diagnosis: null, createdAtMs: nowMs });
      return store.get(row.commandId)!;
    },
    finish: async (id, patch) => void Object.assign(store.get(id)!, { state: patch.state, updateId: patch.updateId ?? null, diagnosis: patch.diagnosis ?? null }),
    get: async (id) => store.get(id) ?? null,
  };
  let landed: JsTransaction | null = null;
  const submitAndWaitForTransaction = vi.fn(async () => {
    const r = outcome();
    if (r instanceof Error) throw r;
    landed = r;
    return { transaction: r, submissionId: "s", attempts: 1, recovered: false };
  });
  const client = { submitAndWaitForTransaction, findAcceptedCompletion: async () => null, updateById: async () => landed } as unknown as LedgerClient;
  const deps = { client, seats, markets, journal, now: () => T };
  const writer = createRestWriter(deps, seatCommandKit(deps));
  const sent = () => (submitAndWaitForTransaction.mock.calls as unknown as Array<[{ actAs: string[]; commandId: string; commands: Array<{ ExerciseCommand: { templateId: string; contractId: string; choice: string; choiceArgument: Record<string, unknown> } }> }]>).map((c) => c[0]);
  return { writer, sent, seats, store };
}

const notFound = (cid: string) => errorFromResponse("/v2/commands/submit-and-wait-for-transaction", 404, "application/json", JSON.stringify({ code: "CONTRACT_NOT_FOUND", cause: `Contract could not be found with id ${cid}`, errorCategory: 11, context: {} }));

describe("the seat places the venue's offer of a resting call", () => {
  it("exercises RestOffer_Place as the seat only, with its own cash, and answers from the call the transaction created", async () => {
    const { writer, sent } = setup({ offers: undefined, restingOffers: [offer()], cash: [{ cid: "00c5a1", amount: 4_000_000n, bucket: "demo" }, { cid: "00c5a2", amount: 3_000_000n, bucket: "demo" }] } as Partial<SeatSnapshot>, () => tx([callEvent("SideUp", "550")]));
    const r = await writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" });
    expect(r).toMatchObject({ kind: "confirmed", recovered: false, rested: { marketId: MARKET, side: "up", callRef: "rc-1", lots: 10n, priceTicks: 550, escrowBase: 5_500_000n, contractsRaw: 10_000_000n, expireSec: (T + 390_000) / 1000 } });
    const [s] = sent();
    expect(s!.actAs).toEqual([SEAT]);
    expect(s!.commandId).toBe(`rest:${JOURNAL_ID}`);
    expect(s!.commands[0]!.ExerciseCommand).toMatchObject({ contractId: "00ee01", choice: "RestOffer_Place", choiceArgument: { cash: ["00c5a1", "00c5a2"] } });
  });

  it("reports a DOWN call's price in YES terms (the seat's own 45c is 550 of 1000)", () => {
    expect(restedFrom(tx([callEvent("SideDown", "450")]), SEAT)).toMatchObject({ side: "down", priceTicks: 550, escrowBase: 4_500_000n });
  });

  it("refuses, sending nothing, when the offer is gone or has lapsed, or the cash does not cover the escrow", async () => {
    const gone = setup({ restingOffers: [] }, () => tx([]));
    expect(await gone.writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" })).toMatchObject({ kind: "refused", diagnosis: { kind: "order-expired" } });
    expect(gone.sent()).toHaveLength(0);
    const lapsed = setup({ restingOffers: [offer({ validUntilMs: T - 1 })], cash: [{ cid: "c", amount: 9_000_000n, bucket: "demo" }] }, () => tx([]));
    expect(await lapsed.writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" })).toMatchObject({ kind: "refused", diagnosis: { kind: "order-expired" } });
    const poor = setup({ restingOffers: [offer()], cash: [{ cid: "c", amount: 5_499_999n, bucket: "demo" }] }, () => tx([]));
    expect(await poor.writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" })).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
    expect(poor.sent()).toHaveLength(0);
  });

  it("answers a retry of a placement that already landed with its own transaction, never a second call", async () => {
    const { writer, sent } = setup({ restingOffers: [offer()], cash: [{ cid: "00c5a1", amount: 9_000_000n, bucket: "demo" }] }, () => tx([callEvent("SideUp", "550")]));
    await writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" });
    const again = await writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" });
    expect(again).toMatchObject({ kind: "confirmed", recovered: true, rested: { callRef: "rc-1" } });
    expect(sent()).toHaveLength(1);
  });

  it("an offer swept between the read and the submit is the offer lapsing, not a contract fault", async () => {
    const { writer } = setup({ restingOffers: [offer()], cash: [{ cid: "c", amount: 9_000_000n, bucket: "demo" }] }, () => notFound("00ee01"));
    expect(await writer.placeRest(actor, { journalId: JOURNAL_ID, offerCid: "00ee01" })).toMatchObject({ kind: "refused", diagnosis: { kind: "order-expired" } });
  });
});

describe("the seat cancels its resting calls", () => {
  it("exercises Rest_Cancel on each call it names, found by reference, and reports what came back", async () => {
    const { writer, sent } = setup({ restingCalls: [call(), call({ cid: "00ca12", callRef: "rc-2" }), call({ cid: "00ff01", callRef: "rc-3", marketId: appMarketId("NVDA-5m:1"), damlMarketId: "NVDA-5m:1" })] }, () => tx([cashEvent("5500000"), { ...cashEvent("5500000"), CreatedEvent: { ...cashEvent("5500000").CreatedEvent, contractId: "00refund2", nodeId: 2 } }]));
    const r = await writer.cancelRest(actor, { journalId: JOURNAL_ID, marketId: MARKET, callRefs: ["rc-1", "rc-2", "rc-3"] });
    // rc-3 is on another Window: it is not this request's to cancel
    expect(r).toMatchObject({ kind: "confirmed", cancelled: 2, refundedBase: 11_000_000n });
    const [s] = sent();
    expect(s!.actAs).toEqual([SEAT]);
    expect(s!.commandId).toBe(`rest-cancel:${JOURNAL_ID}`);
    expect(s!.commands.map((c) => [c.ExerciseCommand.contractId, c.ExerciseCommand.choice])).toEqual([["00ca11", "Rest_Cancel"], ["00ca12", "Rest_Cancel"]]);
  });

  it("a call that already ended is `gone`: nothing is sent", async () => {
    const { writer, sent } = setup({ restingCalls: [] }, () => tx([]));
    expect(await writer.cancelRest(actor, { journalId: JOURNAL_ID, marketId: MARKET, callRefs: ["rc-1"] })).toEqual({ kind: "gone" });
    expect(sent()).toHaveLength(0);
  });

  it("a partial fill between the read and the submit re-created the call: it looks again once and cancels the new contract", async () => {
    let attempts = 0;
    let reads = 0;
    const { writer, sent, seats } = setup({ restingCalls: [call()] }, () => (attempts++ === 0 ? notFound("00ca11") : tx([cashEvent("3300000")])));
    (seats.read as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ party: SEAT, offset: 8, cash: [], legs: [], quotes: [], restingOffers: [], restingCalls: [reads++ < 1 ? call() : call({ cid: "00ca12", lots: 6n, escrow: 3_300_000n })] }));
    const r = await writer.cancelRest(actor, { journalId: JOURNAL_ID, marketId: MARKET, callRefs: ["rc-1"] });
    expect(r).toMatchObject({ kind: "confirmed", cancelled: 1, refundedBase: 3_300_000n });
    expect(sent().map((s) => s.commands[0]!.ExerciseCommand.contractId)).toEqual(["00ca11", "00ca12"]);
  });
});

describe("what a resting call does to the seat's other reads", () => {
  it("keeps the seat busy until its call expires, so a seat is never drained under one", () => {
    expect(busyUntilMs({ legs: [], quotes: [], restingCalls: [call({ expiresAtMs: T + 390_000 })] })).toBe(T + 390_000);
    expect(busyUntilMs({ legs: [], quotes: [] })).toBe(0);
  });

  it("classifies the two new steps", () => {
    expect(classifyRejection(notFound("00ee01"), { step: "rest", offerCid: "00ee01" }).kind).toBe("order-expired");
    expect(classifyRejection(notFound("00c5a3"), { step: "rest", offerCid: "00ee01", cashCids: ["00c5a3"] }).kind).toBe("insufficient-collateral");
    expect(classifyRejection(notFound("00ca11"), { step: "rest-cancel", callCids: ["00ca11"] }).kind).toBe("order-expired");
  });
});
