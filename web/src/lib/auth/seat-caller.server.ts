import { parseSeatReadHeader, SEAT_READ_HEADER, seatReadFresh, seatReadText } from "@owarine/core/auth";
import type { Cluster } from "@owarine/core/constants";
import type { Address } from "@owarine/core/types";
import { readSeatCookie, seatCookieFrom } from "../seat-cookie.server";
import { verifyWalletMessage } from "./verify-signed-message.server";

/**
 * Who is asking, as a seat (plan §5): the address whose key signed a fresh `seatReadText` (the phone's proof), or,
 * failing that, the address the HttpOnly seat cookie was minted for (`leaseId.address.expiry.mac`, the web's proof,
 * C4). The cookie's MAC is enough for reads keyed by address (a seat's own history); routes that act or read AS the
 * seat's party also check the lease row (`seat.server.ts`). Never throws on input, so a route answers 403 without a
 * try/catch around attacker text.
 */
export async function seatCaller(headers: Headers, cluster: Cluster, nowMs: number = Date.now()): Promise<Address | null> {
  const proof = parseSeatReadHeader(headers.get(SEAT_READ_HEADER));
  if (proof && seatReadFresh(proof.issuedAtMs, nowMs)) {
    const text = seatReadText(proof.address, proof.issuedAtMs, cluster);
    if (await verifyWalletMessage({ text, signature: proof.signature, signer: proof.address })) return proof.address;
  }
  const secret = process.env.OWARINE_SEAT_COOKIE_SECRET;
  if (!secret || secret.length < 32) return null;
  return readSeatCookie(secret, seatCookieFrom(headers), nowMs)?.address ?? null;
}
