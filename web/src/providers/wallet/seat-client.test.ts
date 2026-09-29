import { messageBytes } from "@agari/core/auth";
import { decodeBase58, encodeBase58, toSignature } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { SEAT_LEASE, seatSigner, takeSeat } from "./seat-client";

// Node has no IndexedDB or window: the seat still works for the page, which is the storage-blocked path.
describe("seat key", () => {
  it("is a non-extractable ed25519 key whose base58 public key is the address", async () => {
    const seat = await takeSeat(1_000);
    expect(decodeBase58(seat.address)?.length).toBe(32);
    expect(seat.keyPair.privateKey.extractable).toBe(false);
    expect(seat.createdAtMs).toBe(1_000);
  });

  it("signs raw UTF-8 text that the server's verifier accepts, and nothing else", async () => {
    const seat = await takeSeat();
    const signer = seatSigner(seat);
    expect(signer.address).toBe(seat.address);
    const text = "Agari seat check\nNetwork: Canton DevNet";
    const signature = toSignature(encodeBase58(await signer.signMessage(messageBytes(text))));
    await expect(verifyWalletMessage({ text, signature, signer: seat.address })).resolves.toBe(true);
    await expect(verifyWalletMessage({ text: `${text}!`, signature, signer: seat.address })).resolves.toBe(false);
    const other = await takeSeat();
    expect(other.address).not.toBe(seat.address);
    await expect(verifyWalletMessage({ text, signature, signer: other.address })).resolves.toBe(false);
  });

  it("states the lease honestly until the lease routes land", () => {
    expect(SEAT_LEASE).toEqual({ kind: "not-live", reason: "seat lease: Canton adapter not live yet (C1 stub)" });
  });
});
