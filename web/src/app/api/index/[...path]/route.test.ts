import { formatSeatReadHeader, messageBytes, SEAT_READ_HEADER, SEAT_READ_TTL_MS, seatReadText } from "@owarine/core/auth";
import { encodeBase58, toAddress, toSignature, type Address } from "@owarine/core/types";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webEnv } from "@/lib/env";
import { GET } from "./route";

interface TestSeat {
  address: Address;
  sign(text: string): Promise<string>;
}

async function newSeat(): Promise<TestSeat> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
  const address = toAddress(encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))));
  return {
    address,
    sign: async (text) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, Uint8Array.from(messageBytes(text))))),
  };
}

async function proofFor(seat: TestSeat, issuedAtMs: number = Date.now(), signedAs: TestSeat = seat): Promise<string> {
  const signature = toSignature(await signedAs.sign(seatReadText(seat.address, issuedAtMs, webEnv.markets.cluster)));
  return formatSeatReadHeader({ address: seat.address, issuedAtMs, signature });
}

async function get(path: string, header?: string): Promise<Response> {
  const request = new NextRequest(`http://localhost/api/index/${path}`, { headers: header ? { [SEAT_READ_HEADER]: header } : {} });
  return GET(request, { params: Promise.resolve({ path: path.split("?")[0]!.split("/") }) });
}

describe("/api/index wallet scope (plan §5: a seat reads only its own rows)", () => {
  let alice: TestSeat;
  let bob: TestSeat;
  beforeEach(async () => {
    vi.stubEnv("DATABASE_URL", "");
    alice = await newSeat();
    bob = await newSeat();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["fills", "positions", "actions", "orders", "receipts", "resting"])("refuses %s with no proof", async (resource) => {
    const res = await get(`wallet/${alice.address}/${resource}`);
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses another seat's proof for this address", async () => {
    expect((await get(`wallet/${alice.address}/fills`, await proofFor(bob))).status).toBe(403);
  });

  it("refuses a proof for this address signed by another key", async () => {
    expect((await get(`wallet/${alice.address}/positions`, await proofFor(alice, Date.now(), bob))).status).toBe(403);
  });

  it("refuses a stale proof and a malformed header", async () => {
    expect((await get(`wallet/${alice.address}/actions`, await proofFor(alice, Date.now() - SEAT_READ_TTL_MS - 1_000))).status).toBe(403);
    expect((await get(`wallet/${alice.address}/actions`, "not.a.proof"))).toHaveProperty("status", 403);
  });

  it("lets the seat itself through to the projection (503 here: no database in the test)", async () => {
    const res = await get(`wallet/${alice.address}/orders`, await proofFor(alice));
    expect(res.status).toBe(503);
  });

  it("leaves public scopes open", async () => {
    expect((await get("status")).status).toBe(503);
  });
});
