import { parseSeatReadHeader, SEAT_READ_HEADER } from "@owarine/core/auth";
import { encodeBase58 } from "@owarine/core/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMarketsEnv } from "../env";
import { configureMarkets } from "../runtime/read-runtime";
import { indexRows } from "./index-api";
import { registerSeatSigner } from "./ledger-api";

/**
 * C11b, found on the iOS simulator: a seat's own index rows (`wallet/<address>/…`) answer only that seat, by its signed
 * read header or the web's cookie. The indexer client sent neither, so the phone's portfolio and verdict reads were
 * refused ("indexer 403: a seat reads only its own rows") once its fetch stopped carrying a cookie.
 */
async function newSeat() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
  const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  return { address: address as never, signMessage: async (b: Uint8Array) => new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, b as Uint8Array<ArrayBuffer>)) };
}

function captureFetch(): Headers[] {
  const seen: Headers[] = [];
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    seen.push(new Headers(init?.headers));
    return new Response(JSON.stringify({ rows: [] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  return seen;
}

afterEach(() => {
  registerSeatSigner(null);
  vi.unstubAllGlobals();
});

describe("indexRows: a seat's own rows carry its read header, public rows never do (C11b)", () => {
  it("signs a wallet read with the registered seat", async () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "https://site.test/api/ledger", indexerUrl: "https://site.test/api/index" }));
    const seat = await newSeat();
    registerSeatSigner(seat);
    const seen = captureFetch();
    await indexRows(`wallet/${seat.address}/positions`, { unredeemed: 1 });
    const proof = parseSeatReadHeader(seen[0]?.get(SEAT_READ_HEADER) ?? null);
    expect(proof?.address).toBe(seat.address);
  });

  it("sends no header on a public read, nor on a wallet read without a seat", async () => {
    configureMarkets(parseMarketsEnv({ cluster: "localnet", ledgerApiPath: "https://site.test/api/ledger", indexerUrl: "https://site.test/api/index" }));
    const seat = await newSeat();
    registerSeatSigner(seat);
    const seen = captureFetch();
    await indexRows("markets", { state: "open", limit: 7 });
    registerSeatSigner(null);
    await indexRows(`wallet/${seat.address}/fills`, { limit: 3 });
    expect(seen.map((h) => h.get(SEAT_READ_HEADER))).toEqual([null, null]);
  });
});
