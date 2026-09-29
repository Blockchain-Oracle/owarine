import { parseSeatReadHeader, SEAT_READ_HEADER, seatReadFresh, seatReadText } from "@agari/core/auth";
import type { Cluster } from "@agari/core/constants";
import type { Address } from "@agari/core/types";
import { verifyWalletMessage } from "./verify-signed-message.server";

/**
 * Who is asking, as a seat (plan §5): the address whose key signed a fresh `seatReadText`, or null. The header is the
 * only proof in C1; the seat cookie (`leaseId.address.expiry.mac`, HttpOnly) joins it when the lease routes land in C4.
 * Never throws on input, so a route answers 403 without a try/catch around attacker text.
 */
export async function seatCaller(headers: Headers, cluster: Cluster, nowMs: number = Date.now()): Promise<Address | null> {
  const proof = parseSeatReadHeader(headers.get(SEAT_READ_HEADER));
  if (!proof || !seatReadFresh(proof.issuedAtMs, nowMs)) return null;
  const text = seatReadText(proof.address, proof.issuedAtMs, cluster);
  return (await verifyWalletMessage({ text, signature: proof.signature, signer: proof.address })) ? proof.address : null;
}
