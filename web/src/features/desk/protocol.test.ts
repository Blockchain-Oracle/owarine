import { messageBytes } from "@owarine/core/auth";
import { encodeBase58, toAddress, toSignature } from "@owarine/core/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/seat-caller.server", () => ({ seatCaller: async () => null }));

const { verifyOwner } = await import("./auth.server");
const { deskModeText, deskOwnerActionText, deskShareText } = await import("./protocol");

/** A real ed25519 seat key: the address is its base58 public key, the signature covers exactly the text's UTF-8 bytes. */
async function seat() {
  const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  return {
    address: toAddress(encodeBase58(raw)),
    sign: async (text: string) => toSignature(encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, keys.privateKey, Uint8Array.from(messageBytes(text)))))),
  };
}

describe("the desk's signed owner request (C10e.5: credits, not USDC)", () => {
  const nowMs = Date.parse("2026-09-30T10:00:00Z");
  const signedAtIso = new Date(nowMs).toISOString();

  it("asks to sell for credits and never names USDC", () => {
    const sell = deskOwnerActionText({ owner: "owner", kind: "sell_all", signedAtIso });
    expect(sell).toContain("Sell every holding in my desk for credits at its next check.");
    expect(sell).not.toMatch(/usdc/i);
    expect(deskOwnerActionText({ owner: "owner", kind: "close", signedAtIso })).not.toMatch(/usdc/i);
  });

  it("what the signer builds is what the route verifies: the owner's signature over the text passes for both requests", async () => {
    const owner = await seat();
    for (const kind of ["sell_all", "close"] as const) {
      const signature = await owner.sign(deskOwnerActionText({ owner: owner.address, kind, signedAtIso }));
      // the route rebuilds the text from the same fields
      expect(await verifyOwner({ owner: owner.address, text: deskOwnerActionText({ owner: owner.address, kind, signedAtIso }), signature, desk: null, signedAtIso, nowMs })).toBeNull();
    }
  });

  it("a signature over the old USDC wording, another request, or another seat is refused", async () => {
    const owner = await seat();
    const stranger = await seat();
    const text = deskOwnerActionText({ owner: owner.address, kind: "sell_all", signedAtIso });
    const old = await owner.sign(text.replace("for credits", "to USDC"));
    expect((await verifyOwner({ owner: owner.address, text, signature: old, desk: null, signedAtIso, nowMs }))?.status).toBe(401);
    const close = await owner.sign(deskOwnerActionText({ owner: owner.address, kind: "close", signedAtIso }));
    expect((await verifyOwner({ owner: owner.address, text, signature: close, desk: null, signedAtIso, nowMs }))?.status).toBe(401);
    expect((await verifyOwner({ owner: owner.address, text, signature: await stranger.sign(text), desk: null, signedAtIso, nowMs }))?.status).toBe(401);
  });

  it("the other two owner texts (sharing, mode) verify the same way", async () => {
    const owner = await seat();
    const share = deskShareText({ owner: owner.address, on: true, signedAtIso });
    expect(await verifyOwner({ owner: owner.address, text: share, signature: await owner.sign(share), desk: null, signedAtIso, nowMs })).toBeNull();
    const mode = deskModeText({ owner: owner.address, mode: "ask_first", signedAtIso });
    expect(await verifyOwner({ owner: owner.address, text: mode, signature: await owner.sign(mode), desk: null, signedAtIso, nowMs })).toBeNull();
  });
});
