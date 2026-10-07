import { formatSeatReadHeader, messageBytes, SEAT_READ_HEADER, seatReadText } from "@owarine/core/auth";
import { encodeBase58, toSignature } from "@owarine/core/types";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/** C4d M4: a seat-store failure reached the client as the database's own text. Now: what failed and a reference only. */
const SECRET_TEXT = "password authentication failed for user \"owarine\" at db.internal:5432";
vi.mock("./ledger.server", () => ({
  seatServer: () => ({
    ok: true,
    server: { env: { OWARINE_SEAT_COOKIE_SECRET: "x".repeat(40) }, store: { byAddress: async () => { throw new Error(SECRET_TEXT); }, byLease: async () => null } },
  }),
}));
vi.mock("./env", () => ({ webEnv: { markets: { cluster: "devnet" }, appOrigin: "https://site.test" } }));
const { seatFromRequest } = await import("./seat.server");

describe("a seat-store failure is not echoed (C4d M4)", () => {
  it("answers 503 with an error reference, never the database's text", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
    const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as never;
    const now = Date.now();
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(seatReadText(address, now, "devnet")) as Uint8Array<ArrayBuffer>));
    const headers = { [SEAT_READ_HEADER]: formatSeatReadHeader({ address, issuedAtMs: now, signature: toSignature(encodeBase58(sig)) }) };
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const auth = await seatFromRequest(new NextRequest("https://site.test/api/ledger/me/legs", { headers }), { write: false });
    expect(auth.ok).toBe(false);
    const body = auth.ok ? null : await auth.response.json();
    expect(auth.ok ? 0 : auth.response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain("db.internal");
    expect(body.diagnosis.technical).toMatch(/^seat store unreachable \(ref [0-9a-f]{8}\)$/);
    expect(errors.mock.calls[0]?.[0]).toContain(SECRET_TEXT);
  });
});
