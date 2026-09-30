import { formatSeatReadHeader, messageBytes, SEAT_READ_HEADER, seatReadText } from "@agari/core/auth";
import { encodeBase58, toSignature } from "@agari/core/types";
import { seatLeaseText } from "@agari/markets";
import { SEAT_KEY_BYTES, seatSession } from "@agari/markets/sessions/mobile";
import { describe, expect, it } from "vitest";
import { seatCaller } from "@/lib/auth/seat-caller.server";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { newSeatKey } from "./seat-key";

const CLUSTER = "devnet" as const;
const NOW = 1_790_000_000_000;

/**
 * Plan iOS step 1: the phone's seat key, made exactly as the app makes it (PKCS#8 import, JWK public half, 64-byte
 * `seed ‖ public key`), signs through `seatSession` what the web server's own verifier accepts, for the two texts the
 * phone sends: the lease request and the signed seat read header (the phone has no cookie).
 */
describe("the phone's seat key against the server's verifier", () => {
  it("is 64 bytes whose public half is its seed's, named by its base58 address", async () => {
    const key = await newSeatKey();
    expect(key.length).toBe(SEAT_KEY_BYTES);
    const seat = await seatSession(key);
    expect(seat.address).toBe(encodeBase58(key.subarray(32)));
  });

  it("signs a lease request the server accepts, and nothing else", async () => {
    const seat = await seatSession(await newSeatKey());
    const text = seatLeaseText(seat.address, NOW, CLUSTER);
    const signature = toSignature(encodeBase58(await seat.signMessage(messageBytes(text))));
    await expect(verifyWalletMessage({ text, signature, signer: seat.address })).resolves.toBe(true);
    await expect(verifyWalletMessage({ text: `${text} `, signature, signer: seat.address })).resolves.toBe(false);
    const other = await seatSession(await newSeatKey());
    await expect(verifyWalletMessage({ text, signature, signer: other.address })).resolves.toBe(false);
  });

  it("builds a signed seat read header that seatCaller resolves to the seat, until it goes stale", async () => {
    const seat = await seatSession(await newSeatKey());
    const signature = toSignature(encodeBase58(await seat.signMessage(messageBytes(seatReadText(seat.address, NOW, CLUSTER)))));
    const headers = new Headers({ [SEAT_READ_HEADER]: formatSeatReadHeader({ address: seat.address, issuedAtMs: NOW, signature }) });
    await expect(seatCaller(headers, CLUSTER, NOW + 1_000)).resolves.toBe(seat.address);
    await expect(seatCaller(headers, CLUSTER, NOW + 6 * 60_000)).resolves.toBeNull();
    await expect(seatCaller(headers, "mainnet", NOW + 1_000)).resolves.toBeNull();
  });
});
