import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IntentRecord, OrderRequest } from "@agari/core/ports";
import { restingQuote } from "@agari/core/orders";
import type { EventMarket } from "@agari/core/types";
import { parseMarketsEnv } from "../env";
import { registerSeatSigner } from "../provider/ledger-api";
import { toWire } from "../provider/ledger-wire";
import { configureMarkets } from "../runtime/read-runtime";
import { appMarketId } from "../server/ids";
import { createMemoryJournal } from "./journal-memory";
import { submitRestingCancel, submitSeatRest } from "./rest-lane";
import { allowAllStopGate } from "./stop-gate";

const WALLET = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T" as EventMarket["collateral"];
const MARKET = appMarketId("TSLA-5m:7");
const UPDATE = "1220" + "cd".repeat(32);
const GRID = { lotBase: 1_000_000n, tickBase: 1_000n, cashUnit: 1_000n, minLots: 1n };
const sized = restingQuote({ side: "up", priceCents: 55, stakeBase: 5_500_000n, grid: GRID, decimals: 6, quotedAtMs: 1 });
if (!sized.ok) throw new Error("fixture must size");
const request = (over: Partial<OrderRequest> = {}): OrderRequest => ({ market: { marketId: MARKET } as EventMarket, side: "up", stakeBase: 5_500_000n, displayedQuote: sized.quote, wallet: WALLET, entry: "rest", ...over });
const rested = { marketId: MARKET, side: "up", txHash: UPDATE, callRef: "rc-1", lots: 10n, priceTicks: 550, contractsRaw: 10_000_000n, escrowBase: 5_500_000n, expireSec: 1_790_000_390 };
const offerReply = { kind: "offer", offerCid: "00ee01", validUntilMs: 30_000, rested: { ...rested, txHash: undefined } };

type Handler = (url: string, init: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
function serve(handler: Handler) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null });
    const r = await handler(url, init);
    return new Response(JSON.stringify(toWire(r.body)), { status: r.status ?? 200 });
  });
  return calls;
}

function lane() {
  const journal = createMemoryJournal(() => 1_000);
  let now = 1_000;
  const reservations: bigint[] = [];
  const stopGate = { checkAndReserve: async (_w: string, cost: bigint) => (reservations.push(cost), { ok: true as const, reservationId: `r${reservations.length}` }), reconcile: vi.fn(async () => undefined) };
  return { journal, stopGate, deps: { wallet: WALLET, journal, stopGate: stopGate as unknown as typeof allowAllStopGate, nowMs: () => (now += 500), pollMs: 1, confirmCapMs: 5_000, sleep: async () => undefined } };
}
const records = async (journal: ReturnType<typeof createMemoryJournal>) => (journal as unknown as { listUnresolved(w: string): Promise<IntentRecord[]> }).listUnresolved(WALLET);

beforeAll(() => configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "http://site.test/api/ledger" })));
afterEach(() => {
  vi.unstubAllGlobals();
  registerSeatSigner(null);
});

describe("resting a call: the venue's offer, then the seat's own place", () => {
  it("asks for the offer as the ticket sized it, journals BEFORE the place, and answers `resting` from the placed call", async () => {
    const { journal, deps, stopGate } = lane();
    let journaledAtPlace: IntentRecord[] = [];
    const calls = serve(async (url) => {
      if (url.endsWith("/resting")) return { body: offerReply };
      journaledAtPlace = await records(journal);
      return { body: { kind: "confirmed", rested, updateId: UPDATE, recovered: false } };
    });
    const phases: string[] = [];
    const outcome = await submitSeatRest(deps, request({ restUntil: "lock" }), (p) => phases.push(p));
    expect(outcome).toEqual({ status: "resting", rested });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST http://site.test/api/ledger/resting", "POST http://site.test/api/ledger/resting/00ee01/place"]);
    expect(calls[0]!.body).toEqual({ marketId: MARKET, side: "up", stakeBase: "5500000", priceCents: 55, restUntil: "lock", displayedEscrowBase: "5500000" });
    expect(journaledAtPlace).toHaveLength(1);
    expect(calls[1]!.body).toEqual({ commandId: journaledAtPlace[0]!.id });
    expect(phases).toEqual(["submitted", "confirmed"]);
    expect(await records(journal)).toEqual([]);
    // the daily stop was asked and let go: a call spends nothing until it fills
    expect(stopGate.reconcile).toHaveBeenCalledWith("r1", 0n);
  });

  it("a refused offer (would cross, too many, not listed) is a refusal and nothing is journaled or placed", async () => {
    const { journal, deps } = lane();
    const calls = serve(() => ({ body: { kind: "refused", diagnosis: { kind: "too-many-resting", retryable: false, technical: "16 calls" } } }));
    expect(await submitSeatRest(deps, request())).toMatchObject({ status: "refused", diagnosis: { kind: "too-many-resting" } });
    expect(calls).toHaveLength(1);
    expect(await records(journal)).toEqual([]);
  });

  it("a grid that sizes the call differently is a requote with the fresh quote", async () => {
    const { deps } = lane();
    serve(() => ({ body: { kind: "requote", quote: sized.quote } }));
    expect(await submitSeatRest(deps, request())).toMatchObject({ status: "requote", quote: { maxCostBase: 5_500_000n } });
  });

  it("an offer that lapsed before the place is a refusal, the journal closed as failed", async () => {
    const { journal, deps } = lane();
    serve((url) => (url.endsWith("/resting") ? { body: offerReply } : { body: { kind: "refused", diagnosis: { kind: "order-expired", retryable: false, technical: "the offer lapsed" } } }));
    expect(await submitSeatRest(deps, request())).toMatchObject({ status: "refused", diagnosis: { kind: "order-expired" } });
    expect(await records(journal)).toEqual([]);
  });

  it("no answer to the place: never re-sent under a new id; polls, then re-asks under the SAME id for the call", async () => {
    const { deps } = lane();
    let places = 0;
    const calls = serve((url) => {
      if (url.endsWith("/resting")) return { body: offerReply };
      if (url.includes("/commands/")) return { body: { commandId: url.split("/").pop(), status: calls.filter((c) => c.url.includes("/commands/")).length > 1 ? "landed" : "pending", updateId: null, diagnosis: null } };
      places += 1;
      return places === 1 ? { status: 503, body: { diagnosis: { kind: "send-unknown", retryable: true, technical: "503" } } } : { body: { kind: "confirmed", rested, updateId: UPDATE, recovered: true } };
    });
    expect((await submitSeatRest(deps, request())).status).toBe("resting");
    const placeBodies = calls.filter((c) => c.url.endsWith("/place")).map((c) => (c.body as { commandId: string }).commandId);
    expect(placeBodies).toHaveLength(2);
    expect(new Set(placeBodies).size).toBe(1);
  });

  it("refuses a request for another seat before anything is sent", async () => {
    const { deps } = lane();
    const calls = serve(() => ({ body: {} }));
    expect(await submitSeatRest(deps, request({ wallet: "11111111111111111111111111111111" as typeof WALLET }))).toMatchObject({ status: "refused", diagnosis: { kind: "signer-required" } });
    expect(calls).toHaveLength(0);
  });
});

describe("cancelling resting calls", () => {
  it("sends the call references under a journaled id and confirms with the update id", async () => {
    const { journal, deps } = lane();
    const calls = serve(() => ({ body: { kind: "confirmed", updateId: UPDATE, refundedBase: "5500000", cancelled: 1, recovered: false } }));
    expect(await submitRestingCancel(deps, { marketId: MARKET, callRefs: ["rc-1"] })).toEqual({ status: "confirmed", txHash: UPDATE });
    expect(calls[0]!.url).toBe("http://site.test/api/ledger/resting/cancel");
    expect(calls[0]!.body).toMatchObject({ marketId: MARKET, callRefs: ["rc-1"] });
    expect(await records(journal)).toEqual([]);
  });

  it("a call that already ended answers in words, and changes nothing", async () => {
    const { journal, deps } = lane();
    serve(() => ({ body: { kind: "gone" } }));
    expect(await submitRestingCancel(deps, { marketId: MARKET, callRefs: ["rc-1"] })).toMatchObject({ status: "refused", diagnosis: { technical: "This call already ended: it filled, expired or was cancelled." } });
    expect(await records(journal)).toEqual([]);
  });
});
