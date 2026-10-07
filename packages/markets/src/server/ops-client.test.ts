import { describe, expect, it } from "vitest";
import { toMarketId } from "@owarine/core/types";
import { appMarketId } from "./ids";
import { createOpsClient, OPS_NONCE_HEADER, OPS_QUOTES_PATH, OPS_SIG_HEADER, OPS_TS_HEADER, opsSignature, verifyOpsSignature } from "./ops-client";

const SECRET = "k".repeat(40);
const NOW = 1_790_000_000_000;
const MARKET = appMarketId("PRB-60:0");

describe("ops call signature", () => {
  const body = '{"a":1}';
  const nonce = "ab".repeat(16);
  const sig = opsSignature(SECRET, NOW, nonce, "POST", OPS_QUOTES_PATH, body);

  it("verifies a fresh, untouched call and nothing else", () => {
    expect(verifyOpsSignature(SECRET, { ts: String(NOW), nonce, sig, method: "POST", path: OPS_QUOTES_PATH, body, nowMs: NOW + 1_000 })).toBe(true);
    expect(verifyOpsSignature(SECRET, { ts: String(NOW), nonce, sig, method: "POST", path: OPS_QUOTES_PATH, body: '{"a":2}', nowMs: NOW })).toBe(false);
    expect(verifyOpsSignature(SECRET, { ts: String(NOW), nonce, sig, method: "POST", path: "/internal/seats/fund", body, nowMs: NOW })).toBe(false);
    expect(verifyOpsSignature("x".repeat(40), { ts: String(NOW), nonce, sig, method: "POST", path: OPS_QUOTES_PATH, body, nowMs: NOW })).toBe(false);
    expect(verifyOpsSignature(SECRET, { ts: String(NOW), nonce, sig, method: "POST", path: OPS_QUOTES_PATH, body, nowMs: NOW + 31_000 })).toBe(false);
    expect(verifyOpsSignature(SECRET, { ts: null, nonce, sig, method: "POST", path: OPS_QUOTES_PATH, body })).toBe(false);
    // C4d L4: the nonce is signed, so another one (or none) does not verify.
    expect(verifyOpsSignature(SECRET, { ts: String(NOW), nonce: "cd".repeat(16), sig, method: "POST", path: OPS_QUOTES_PATH, body, nowMs: NOW })).toBe(false);
    expect(verifyOpsSignature(SECRET, { ts: String(NOW), nonce: null, sig, method: "POST", path: OPS_QUOTES_PATH, body, nowMs: NOW })).toBe(false);
  });
});

describe("ops client", () => {
  const quote = { side: "up", stakeBase: "63414", contractsRaw: "100000", expectedCostBase: "63414", maxCostBase: "63414", limitPriceRaw: "620000", avgPriceBps: 6200, oddsCents: 62, payoutIfRightBase: "100000", fillableStakeBase: "63414", partial: false, feeBps: 228, decimals: 6, quotedAtMs: NOW };

  it("signs the request, sends WHO from its caller, and parses a firm quote", async () => {
    let seen: { url: string; headers: Headers; body: string } | null = null;
    const fetch = (async (url: string, init: RequestInit) => {
      seen = { url, headers: new Headers(init.headers), body: String(init.body) };
      return new Response(JSON.stringify({ kind: "quote", quoteCid: "00q", quote, validUntilMs: NOW + 20_000 }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    const ops = createOpsClient({ baseUrl: "http://ops:4100/", secret: SECRET, fetch, now: () => NOW });
    const reply = await ops.quote({ marketId: MARKET, side: "up", stakeBase: 63_414n, displayedMaxCostBase: 64_000n, party: "seat::1220", leaseId: "L" });
    expect(reply).toMatchObject({ kind: "quote", quoteCid: "00q", quote: { maxCostBase: 63_414n, contractsRaw: 100_000n } });
    expect(seen!.url).toBe("http://ops:4100/internal/quotes");
    expect(JSON.parse(seen!.body)).toEqual({ marketId: MARKET, side: "up", stakeBase: "63414", displayedMaxCostBase: "64000", party: "seat::1220", leaseId: "L" });
    expect(verifyOpsSignature(SECRET, { ts: seen!.headers.get(OPS_TS_HEADER), nonce: seen!.headers.get(OPS_NONCE_HEADER), sig: seen!.headers.get(OPS_SIG_HEADER), method: "POST", path: OPS_QUOTES_PATH, body: seen!.body, nowMs: NOW })).toBe(true);
  });

  it("an unreachable ops, a 5xx and a garbled reply are refusals, never a quote", async () => {
    const down = createOpsClient({ baseUrl: "http://ops", secret: SECRET, fetch: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch });
    expect(await down.quote({ marketId: toMarketId(MARKET), side: "up", stakeBase: 1n, displayedMaxCostBase: 1n, party: "p", leaseId: "L" })).toMatchObject({ kind: "refused", diagnosis: { kind: "rpc-down" } });
    const five = createOpsClient({ baseUrl: "http://ops", secret: SECRET, fetch: (async () => new Response(JSON.stringify({ diagnosis: { kind: "no-liquidity", retryable: false, technical: "no shard" } }), { status: 503 })) as unknown as typeof fetch });
    expect(await five.quote({ marketId: MARKET, side: "up", stakeBase: 1n, displayedMaxCostBase: 1n, party: "p", leaseId: "L" })).toMatchObject({ kind: "refused", diagnosis: { kind: "no-liquidity" } });
    const junk = createOpsClient({ baseUrl: "http://ops", secret: SECRET, fetch: (async () => new Response('{"kind":"quote"}', { status: 200 })) as unknown as typeof fetch });
    expect(await junk.quote({ marketId: MARKET, side: "up", stakeBase: 1n, displayedMaxCostBase: 1n, party: "p", leaseId: "L" })).toMatchObject({ kind: "refused", diagnosis: { kind: "rpc-down" } });
  });
});
