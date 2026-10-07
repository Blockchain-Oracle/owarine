import { messageBytes } from "@owarine/core/auth";
import { decodeBase58, encodeBase58, toSignature } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { seatSigner, takeSeat } from "./seat-client";
import { leasedOf, seatNumberOf } from "./seat-lease-context";

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
    const text = "Owarine seat check\nNetwork: Canton DevNet";
    const signature = toSignature(encodeBase58(await signer.signMessage(messageBytes(text))));
    await expect(verifyWalletMessage({ text, signature, signer: seat.address })).resolves.toBe(true);
    await expect(verifyWalletMessage({ text: `${text}!`, signature, signer: seat.address })).resolves.toBe(false);
    const other = await takeSeat();
    expect(other.address).not.toBe(seat.address);
    await expect(verifyWalletMessage({ text, signature, signer: other.address })).resolves.toBe(false);
  });

  it("labels a leased party by its hint's number, and never invents one", () => {
    expect(seatNumberOf("seat-3::1220abcd")).toBe(3);
    expect(seatNumberOf("seat-a-lk2::1220abcd")).toBeNull();
    expect(leasedOf({ kind: "none" })).toBeNull();
    expect(leasedOf(null)).toBeNull();
  });
});
