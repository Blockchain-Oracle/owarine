import { formatSeatReadHeader, messageBytes, SEAT_READ_HEADER, SEAT_WRITE_HEADER, seatReadText } from "@agari/core/auth";
import { configureMarkets, parseMarketsEnv, registerSeatSigner, seatWriteHeaderValue } from "@agari/markets";
import { encodeBase58, toSignature } from "@agari/core/types";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * C4d M2b: the phone's reusable READ header authorises reads only. Before C4d one captured read header (reused for
 * four minutes) passed `seatFromRequest({ write: true })`, so `POST /api/seat/link` could mint a link code and take the
 * seat over. A write now needs the one-request WRITE proof.
 */
const leases = new Map<string, { leaseId: string; address: string; party: string; lastSeenMs: number }>();
vi.mock("./ledger.server", () => ({
  seatServer: () => ({
    ok: true,
    server: {
      env: { AGARI_SEAT_COOKIE_SECRET: "x".repeat(40) },
      store: { byAddress: async (a: string) => leases.get(a) ?? null, byLease: async () => null, touch: async () => undefined, links: { isLinked: async () => false } },
    },
  }),
}));
vi.mock("./env", () => ({ webEnv: { markets: { cluster: "devnet" }, appOrigin: "https://site.test" } }));

const { seatFromRequest } = await import("./seat.server");
const URL_LINK = "https://site.test/api/seat/link";

afterEach(() => registerSeatSigner(null));

async function seatWithLease() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
  const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as never as string;
  const seat = { address, signMessage: async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, bytes as Uint8Array<ArrayBuffer>)) };
  leases.set(address, { leaseId: "lease-1", address, party: "seat-1::1220aa", lastSeenMs: Date.now() });
  return seat;
}

describe("seatFromRequest: the read header reads, only the write proof writes (C4d M2b)", () => {
  it("a valid read header opens a read but not a write", async () => {
    const seat = await seatWithLease();
    const now = Date.now();
    const signature = toSignature(encodeBase58(await seat.signMessage(messageBytes(seatReadText(seat.address as never, now, "devnet")))));
    const headers = { [SEAT_READ_HEADER]: formatSeatReadHeader({ address: seat.address as never, issuedAtMs: now, signature }) };
    expect((await seatFromRequest(new NextRequest(URL_LINK, { headers }), { write: false })).ok).toBe(true);
    const write = await seatFromRequest(new NextRequest(URL_LINK, { method: "POST", headers, body: "{}" }), { write: true });
    expect(write.ok).toBe(false);
  });

  it("a write proof for this request opens the write once", async () => {
    const seat = await seatWithLease();
    configureMarkets(parseMarketsEnv({ cluster: "devnet", ledgerApiPath: "https://site.test/api/ledger" }));
    registerSeatSigner({ address: seat.address as never, signMessage: (b) => seat.signMessage(b) });
    const header = (await seatWriteHeaderValue("POST", URL_LINK, "{}")) ?? "";
    const req = () => new NextRequest(URL_LINK, { method: "POST", headers: { [SEAT_WRITE_HEADER]: header }, body: "{}" });
    const first = await seatFromRequest(req(), { write: true });
    expect(first.ok && first.seat.caller).toBe(seat.address);
    expect((await seatFromRequest(req(), { write: true })).ok).toBe(false);
  });

  it("a POST read (a ticket preview) from the phone passes on its write proof, once", async () => {
    const seat = await seatWithLease();
    const url = "https://site.test/api/ledger/tickets/range";
    const body = JSON.stringify({ op: "preview" });
    configureMarkets(parseMarketsEnv({ cluster: "devnet", ledgerApiPath: "https://site.test/api/ledger" }));
    registerSeatSigner({ address: seat.address as never, signMessage: (b) => seat.signMessage(b) });
    const header = (await seatWriteHeaderValue("POST", url, body)) ?? "";
    const req = () => new NextRequest(url, { method: "POST", headers: { [SEAT_WRITE_HEADER]: header }, body });
    const read = await seatFromRequest(req(), { write: false });
    expect(read.ok && read.seat.caller).toBe(seat.address);
    expect((await seatFromRequest(req(), { write: false })).ok).toBe(false);
  });
});
