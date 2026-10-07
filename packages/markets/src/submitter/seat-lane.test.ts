import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IntentRecord, OrderRequest } from "@owarine/core/ports";
import type { EventMarket, Quote } from "@owarine/core/types";
import { SEAT_READ_HEADER, SEAT_WRITE_HEADER } from "@owarine/core/auth";
import { parseMarketsEnv } from "../env";
import { registerSeatSigner } from "../provider/ledger-api";
import { toWire } from "../provider/ledger-wire";
import { configureMarkets } from "../runtime/read-runtime";
import { appMarketId } from "../server/ids";
import { createMemoryJournal } from "./journal-memory";
import { submitLegExit, submitSeatOrder } from "./seat-lane";
import { allowAllStopGate } from "./stop-gate";

const WALLET = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T" as EventMarket["collateral"];
const MARKET = appMarketId("PRB-60:0");
const UPDATE = "1220" + "cd".repeat(32);
const quote = (maxCostBase: bigint): Quote => ({ side: "up", stakeBase: 63_414n, contractsRaw: 100_000n, expectedCostBase: maxCostBase, maxCostBase, limitPriceRaw: 620_000n, avgPriceBps: 6_200, oddsCents: 62, payoutIfRightBase: 100_000n, fillableStakeBase: 63_414n, partial: false, feeBps: 228, decimals: 6, quotedAtMs: 1 });
const request = (displayed = quote(64_000n)): OrderRequest => ({ market: { marketId: MARKET, asset: "BTC", intervalSec: 300, decimals: 6 } as EventMarket, side: "up", stakeBase: 63_414n, displayedQuote: displayed, wallet: WALLET });
const booked = { marketId: MARKET, side: "up", contractsRaw: 100_000n, costBase: 63_414n, avgPriceBps: 6_200, txHash: UPDATE, fillCount: 1 };

type Handler = (url: string, init: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
function serve(handler: Handler) {
  const calls: { url: string; method: string; body: unknown; headers: Headers }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) });
    const r = await handler(url, init);
    return new Response(JSON.stringify(toWire(r.body)), { status: r.status ?? 200 });
  });
  return calls;
}

function lane() {
  const journal = createMemoryJournal(() => 1_000);
  let now = 1_000;
  return { journal, deps: { wallet: WALLET, journal, stopGate: allowAllStopGate, nowMs: () => (now += 500), pollMs: 1, confirmCapMs: 5_000, sleep: async () => undefined } };
}
const records = async (journal: ReturnType<typeof createMemoryJournal>) => (journal as unknown as { listUnresolved(w: string): Promise<IntentRecord[]> }).listUnresolved(WALLET);

beforeAll(() => configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "http://site.test/api/ledger" })));
afterEach(() => {
  vi.unstubAllGlobals();
  registerSeatSigner(null);
});

describe("seat order lane", () => {
  it("quotes, journals BEFORE the accept, sends the journal id as the commandId, and books from the reply", async () => {
    const { journal, deps } = lane();
    let journaledAtAccept: IntentRecord[] = [];
    const calls = serve(async (url) => {
      if (url.endsWith("/quotes")) return { body: { kind: "quote", quoteCid: "00q1", quote: quote(63_414n), validUntilMs: 21_000 } };
      journaledAtAccept = await records(journal);
      return { body: { kind: "confirmed", booked, updateId: UPDATE, recovered: false } };
    });
    const phases: string[] = [];
    const outcome = await submitSeatOrder(deps, request(), (p) => phases.push(p));
    expect(outcome).toEqual({ status: "confirmed", booked: { ...booked, txHash: UPDATE } });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST http://site.test/api/ledger/quotes", "POST http://site.test/api/ledger/quotes/00q1/accept"]);
    expect(calls[0]!.body).toEqual({ marketId: MARKET, side: "up", stakeBase: "63414", displayedMaxCostBase: "64000" });
    expect(journaledAtAccept).toHaveLength(1);
    // C5d: recovery reads this back to the reader, so it is words, never base units or a market id.
    expect(journaledAtAccept[0]!.summary).toBe("Up on BTC (5m Window), 0.06 staked");
    expect(calls[1]!.body).toEqual({ commandId: journaledAtAccept[0]!.id });
    expect(calls[1]!.headers.get("x-owarine-seat")).toBe("1");
    expect(phases).toEqual(["submitted", "confirmed"]);
    expect(await records(journal)).toEqual([]);
  });

  it("a price above the confirmed cap is a requote and nothing is journaled or accepted", async () => {
    const { journal, deps } = lane();
    const calls = serve(() => ({ body: { kind: "requote", quote: quote(70_000n) } }));
    const outcome = await submitSeatOrder(deps, request());
    expect(outcome).toMatchObject({ status: "requote", quote: { maxCostBase: 70_000n } });
    expect(calls).toHaveLength(1);
    expect(await records(journal)).toEqual([]);
  });

  it("a quote that lapsed before the accept is re-quoted once and surfaced as a requote", async () => {
    const { deps } = lane();
    let quotes = 0;
    serve((url) => {
      if (url.endsWith("/quotes")) return { body: { kind: "quote", quoteCid: `00q${++quotes}`, quote: quote(63_900n + BigInt(quotes)), validUntilMs: 21_000 } };
      return { body: { kind: "refused", diagnosis: { kind: "order-expired", retryable: false, technical: "the quote is no longer open" } } };
    });
    expect(await submitSeatOrder(deps, request())).toMatchObject({ status: "requote", quote: { maxCostBase: 63_902n } });
    expect(quotes).toBe(2);
  });

  it("no answer to the accept: never re-sent under a new id; polls, then re-asks under the SAME id for the booking", async () => {
    const { journal, deps } = lane();
    let accepts = 0;
    const calls = serve((url) => {
      if (url.endsWith("/quotes")) return { body: { kind: "quote", quoteCid: "00q1", quote: quote(63_414n), validUntilMs: 21_000 } };
      if (url.includes("/commands/")) return { body: { commandId: url.split("/").pop(), status: calls.filter((c) => c.url.includes("/commands/")).length > 1 ? "landed" : "pending", updateId: null, diagnosis: null } };
      accepts += 1;
      return accepts === 1 ? { status: 503, body: { diagnosis: { kind: "send-unknown", retryable: true, technical: "503" } } } : { body: { kind: "confirmed", booked, updateId: UPDATE, recovered: true } };
    });
    const outcome = await submitSeatOrder(deps, request());
    expect(outcome.status).toBe("confirmed");
    const acceptBodies = calls.filter((c) => c.url.endsWith("/accept")).map((c) => (c.body as { commandId: string }).commandId);
    expect(acceptBodies).toHaveLength(2);
    expect(new Set(acceptBodies).size).toBe(1);
    expect(await records(journal)).toEqual([]);
  });

  it("refuses a request for another seat before anything is sent", async () => {
    const { deps } = lane();
    const calls = serve(() => ({ body: {} }));
    expect(await submitSeatOrder(deps, { ...request(), wallet: "11111111111111111111111111111111" as typeof WALLET })).toMatchObject({ status: "refused", diagnosis: { kind: "signer-required" } });
    expect(calls).toHaveLength(0);
  });

  it("signs each write with its own one-request proof, never the reusable read header (C4d M2b)", async () => {
    const { deps } = lane();
    registerSeatSigner({ address: WALLET, signMessage: async () => new Uint8Array(64).fill(7) });
    const calls = serve(() => ({ body: { kind: "requote", quote: quote(70_000n) } }));
    await submitSeatOrder(deps, request());
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers.get(SEAT_READ_HEADER)).toBeNull();
    expect(calls[0]!.headers.get(SEAT_WRITE_HEADER)).toMatch(new RegExp(`^${WALLET}\\.\\d+\\.[0-9a-f]{32}\\.`));
  });
});

describe("leg exits", () => {
  it("claims through the claim route with a journaled command id", async () => {
    const { journal, deps } = lane();
    const calls = serve(() => ({ body: { kind: "confirmed", updateId: UPDATE, payoutBase: "100000", legs: 1, recovered: false } }));
    expect(await submitLegExit(deps, { marketId: MARKET, mode: "claim" })).toEqual({ status: "confirmed", txHash: UPDATE });
    expect(calls[0]!.url).toBe("http://site.test/api/ledger/legs/claim");
    expect(calls[0]!.body).toMatchObject({ marketId: MARKET });
    expect(await records(journal)).toEqual([]);
  });

  it("a refusal (nothing to refund yet) closes the journal record as failed", async () => {
    const { journal, deps } = lane();
    serve(() => ({ body: { kind: "refused", diagnosis: { kind: "not-settled", retryable: false, technical: "the refund opens at refundAfter" } } }));
    expect(await submitLegExit(deps, { marketId: MARKET, mode: "refund" })).toMatchObject({ status: "refused", diagnosis: { kind: "not-settled" } });
    expect(await records(journal)).toEqual([]);
  });
});
