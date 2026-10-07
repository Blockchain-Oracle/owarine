import { formatSeatReadHeader, messageBytes, SEAT_READ_HEADER, SEAT_WRITE_HEADER, seatReadText } from "@owarine/core/auth";
import { encodeBase58, toSignature } from "@owarine/core/types";
import { configureMarkets, parseMarketsEnv, registerSeatSigner, seatLeaseText, seatWriteHeaderValue } from "@owarine/markets";
import { SEAT_KEY_BYTES, seatSession } from "@owarine/markets/sessions/mobile";
import { describe, expect, it } from "vitest";
import { seatCaller } from "@/lib/auth/seat-caller.server";
import { seatWriter } from "@/lib/auth/seat-write.server";
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

  it("signs a write proof (C4d M2b) the server takes once, for that request only, within 30 seconds", async () => {
    configureMarkets(parseMarketsEnv({ cluster: CLUSTER, ledgerApiPath: "https://site.test/api/ledger" }));
    const seat = await seatSession(await newSeatKey());
    registerSeatSigner({ address: seat.address, signMessage: (bytes) => seat.signMessage(bytes) });
    try {
      const url = "https://site.test/api/seat/link";
      const body = JSON.stringify({ a: 1 });
      const header = await seatWriteHeaderValue("POST", url, body, NOW);
      const req = (o: { url?: string; body?: string; method?: string } = {}) =>
        new Request(o.url ?? url, { method: o.method ?? "POST", headers: { [SEAT_WRITE_HEADER]: header ?? "" }, body: o.body ?? body });
      await expect(seatWriter(req(), CLUSTER, NOW + 1_000)).resolves.toBe(seat.address);
      // The same proof again: a replay.
      await expect(seatWriter(req(), CLUSTER, NOW + 2_000)).resolves.toBeNull();
      const fresh = await seatWriteHeaderValue("POST", url, body, NOW);
      const other = (o: { url?: string; body?: string; method?: string }) =>
        new Request(o.url ?? url, { method: o.method ?? "POST", headers: { [SEAT_WRITE_HEADER]: fresh ?? "" }, body: o.body ?? body });
      await expect(seatWriter(other({ url: "https://site.test/api/seat" , method: "DELETE" }), CLUSTER, NOW + 1_000)).resolves.toBeNull();
      await expect(seatWriter(other({ body: JSON.stringify({ a: 2 }) }), CLUSTER, NOW + 1_000)).resolves.toBeNull();
      await expect(seatWriter(other({}), CLUSTER, NOW + 31_000)).resolves.toBeNull();
      // Untouched, the fresh proof still works once.
      await expect(seatWriter(other({}), CLUSTER, NOW + 1_000)).resolves.toBe(seat.address);
    } finally {
      registerSeatSigner(null);
    }
  });
});
