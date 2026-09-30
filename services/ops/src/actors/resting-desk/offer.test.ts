import { describe, expect, it, vi } from "vitest";
import type { LedgerClient } from "@agari/ledger";
import { marketIdFromDaml } from "@agari/core/market";
import { restingOfferReplyWire } from "@agari/markets";
import type { Active, TermsC } from "@agari/markets/ops/canton";
import { jsonText } from "../../http/health";
import { createLadderBoard } from "../market-maker/seat/ladder-board";
import { offer, type OfferDeps } from "./offer";
import { parseRestingRequest } from "./parse";

const V = "venue::1220abcdef";
const SEAT = "seat-1::1220cdef01";
const DAML_ID = "TSLA-5m:7";
const MARKET = marketIdFromDaml(DAML_ID);
/** A Window that opens at 12:05 and locks at 12:09; ops' clock reads 12:00, five minutes before the bell. */
const START = Date.parse("2026-10-01T12:05:00Z") / 1000;
const NOW_MS = Date.parse("2026-10-01T12:00:00Z");
const TERMS: Active<TermsC> = {
  cid: "00terms",
  data: {
    venue: V, resolver: "r::1", seriesKey: "TSLA-5m", marketId: DAML_ID, index: 7, symbol: "TSLA", cashUnit: 1000n, tradingStartSec: START, lockAtSec: START + 240, expirySec: START + 300,
    openDeadlineSec: START + 120, closeDeadlineSec: START + 420, refundAfterSec: START + 1_020, policyVersion: 1, printSource: "attested", minDelaySec: 5, barLenSec: 60, tieUp: true,
    oracles: [], quorum: 1, maxDeviationBps: 50,
  },
};

const req = (over: Record<string, unknown> = {}) =>
  parseRestingRequest({ party: SEAT, leaseId: "lease-1", marketId: MARKET, side: "up", stakeBase: "5500000", priceCents: 55, restUntil: "bell", displayedEscrowBase: "5500000", ...over }) as Exclude<ReturnType<typeof parseRestingRequest>, string>;

function setup(o: { nowMs?: number; count?: number } = {}) {
  const board = createLadderBoard();
  const created = { contractId: "offer1", templateId: "p:PM.Resting:RestingOffer", createArgument: {}, offset: 9, nodeId: 0, packageName: "abu-pm-main", witnessParties: [V], signatories: [V], "createdAt": "" };
  const submitAndWaitForTransaction = vi.fn(async () => ({ transaction: { updateId: "u", offset: 9, effectiveAt: "", synchronizerId: "", recordTime: "", events: [{ CreatedEvent: created }] }, submissionId: "s", attempts: 1, recovered: false }));
  const client = { submitAndWaitForTransaction, ledgerEnd: async () => 8 } as unknown as LedgerClient;
  const deps: OfferDeps = {
    venue: { role: "venue", party: V, client, dryRun: false }, terms: async (id) => (id === MARKET ? TERMS : null), deskCid: async () => "desk1", board,
    infrastructure: new Set([V]), countOpen: async () => o.count ?? 0, log: () => {},
  };
  return { deps, board, submitAndWaitForTransaction, nowMs: () => o.nowMs ?? NOW_MS };
}

const wire = (r: { body: unknown }) => JSON.parse(jsonText(r.body));
const refusedKind = (r: { body: unknown }) => (wire(r) as { diagnosis: { kind: string } }).diagnosis.kind;

describe("the venue's offer to hold a resting call", () => {
  it("offers a call on a listed Window, sized on the Window's own grid, expiring a minute and a half after the bell", async () => {
    const { deps, submitAndWaitForTransaction, nowMs } = setup();
    const r = await offer(deps, nowMs, req());
    const reply = restingOfferReplyWire.parse(wire(r));
    expect(reply).toMatchObject({
      kind: "offer", offerCid: "offer1", validUntilMs: NOW_MS + 30_000,
      // 5.5 credits at 55c on a cash unit of 1000: 550 x 1000 = 550,000 base a lot, so 10 lots and an escrow of 5,500,000
      rested: { marketId: MARKET, side: "up", lots: 10n, priceTicks: 550, escrowBase: 5_500_000n, contractsRaw: 10_000_000n, expireSec: START + 90 },
    });
    if (reply.kind !== "offer") throw new Error("not an offer");
    expect(reply.rested.callRef).toMatch(/^rc-[0-9a-f-]{36}$/);
    const sent = (submitAndWaitForTransaction.mock.calls[0] as unknown as [{ commandId: string; commands: Array<{ ExerciseCommand: { choice: string; choiceArgument: Record<string, unknown> } }> }])[0];
    expect(sent.commandId).toMatch(/^restoffer:/);
    expect(sent.commands[0]!.ExerciseCommand.choice).toBe("RestDesk_Offer");
    expect(sent.commands[0]!.ExerciseCommand.choiceArgument).toMatchObject({
      owner: SEAT, termsCid: "00terms", side: "SideUp", lots: "10", priceTicks: "550", expiresAt: new Date((START + 90) * 1000).toISOString().replace(".000Z", "Z"),
    });
  });

  it("a DOWN call rests at the seat's own price too, and reports its price in YES terms", async () => {
    const { deps, nowMs } = setup();
    const reply = restingOfferReplyWire.parse(wire(await offer(deps, nowMs, req({ side: "down", priceCents: 45, stakeBase: "4500000", displayedEscrowBase: "4500000" }))));
    expect(reply).toMatchObject({ kind: "offer", rested: { side: "down", lots: 10n, priceTicks: 550, escrowBase: 4_500_000n } });
  });

  it("rests until the lock when the seat opted in", async () => {
    const { deps, nowMs } = setup();
    const reply = restingOfferReplyWire.parse(wire(await offer(deps, nowMs, req({ restUntil: "lock" }))));
    expect(reply).toMatchObject({ kind: "offer", rested: { expireSec: START + 240 } });
  });

  it("answers a requote, and offers nothing, when the Window's grid sizes the call differently from the ticket", async () => {
    const { deps, submitAndWaitForTransaction, nowMs } = setup();
    const r = await offer(deps, nowMs, req({ displayedEscrowBase: "5000000" }));
    expect(restingOfferReplyWire.parse(wire(r))).toMatchObject({ kind: "requote", quote: { maxCostBase: 5_500_000n, contractsRaw: 10_000_000n, oddsCents: 55 } });
    expect(submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it("refuses a stake that buys no lot, a Window it does not hold, and a party that is infrastructure", async () => {
    const { deps, nowMs, submitAndWaitForTransaction } = setup();
    expect(refusedKind(await offer(deps, nowMs, req({ stakeBase: "100", displayedEscrowBase: "100" })))).toBe("below-min-quantity");
    expect(refusedKind(await offer(deps, nowMs, req({ marketId: marketIdFromDaml("NOPE-5m:1") })))).toBe("market-not-trading");
    expect(refusedKind(await offer(deps, nowMs, req({ party: V })))).toBe("unknown");
    expect(submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it("caps a seat at 16 calls (and unplaced offers) on one Window", async () => {
    const { deps, nowMs, submitAndWaitForTransaction } = setup({ count: 16 });
    expect(refusedKind(await offer(deps, nowMs, req()))).toBe("too-many-resting");
    expect(submitAndWaitForTransaction).not.toHaveBeenCalled();
    const fifteen = setup({ count: 15 });
    expect(wire(await offer(fifteen.deps, fifteen.nowMs, req())).kind).toBe("offer");
  });

  it("refuses a seat that is draining", async () => {
    const { deps, nowMs } = setup();
    expect(refusedKind(await offer({ ...deps, draining: new Set([SEAT]) }, nowMs, req()))).toBe("market-not-trading");
  });

  it("is post-only: a Window that has opened is no longer listed, and says whether the call would fill at once", async () => {
    const { deps, board, nowMs } = setup({ nowMs: (START + 20) * 1000 });
    // No ladder yet: the bell has rung but the venue has not priced the Window.
    expect(refusedKind(await offer(deps, nowMs, req()))).toBe("market-not-trading");
    // A ladder whose best UP is 53c: a call at 55c reaches it and would fill immediately, one at 50c would only rest.
    board.put({
      marketId: MARKET, damlMarketId: DAML_ID, seriesId: "s", termsCid: "00terms", seriesKey: "TSLA-5m", symbol: "TSLA", index: 7, tradingStartSec: START, lockAtSec: START + 240, expirySec: START + 300,
      quotingUntilSec: START + 240, cashUnit: 1000n, feeRateBps: 100, fairTicks: 500, openPriceE8: 1n, spotE8: 1n, up: [[530, 100n]], down: [[530, 100n]], asOfMs: NOW_MS, state: "quoting",
    });
    expect(refusedKind(await offer(deps, nowMs, req({ priceCents: 55 })))).toBe("post-only-would-cross");
    expect(refusedKind(await offer(deps, nowMs, req({ priceCents: 50, stakeBase: "5000000", displayedEscrowBase: "5000000" })))).toBe("market-not-trading");
  });

  it("does not offer with seconds left before the bell: the offer would be dead on arrival", async () => {
    const { deps, nowMs } = setup({ nowMs: (START - 5) * 1000 });
    expect(refusedKind(await offer(deps, nowMs, req()))).toBe("market-not-trading");
  });

  it("a ledger that refuses the offer answers a refusal with the ledger's reason, never an offer", async () => {
    const { deps, nowMs } = setup();
    const failing = { ...deps.venue, client: { submitAndWaitForTransaction: vi.fn(async () => { throw new Error("boom"); }), ledgerEnd: async () => 8 } as unknown as LedgerClient };
    const r = await offer({ ...deps, venue: failing }, nowMs, req());
    expect(wire(r).kind).toBe("refused");
  });
});
