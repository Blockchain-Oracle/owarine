/**
 * The seat lease (plan §4) as the browser and the phone see it: the text the seat key signs to take or renew a lease,
 * the lease view `/api/seat` answers with, and the calls. The server derives everything else (which party, whether
 * the pool is full) from its own table; the request carries only the seat's address, a time and a signature.
 */
import { networkLine, SIGNED_MESSAGE_BRAND, messageBytes } from "@owarine/core/auth";
import type { Cluster } from "@owarine/core/constants";
import { diagnosisSchema, encodeBase58, type Address } from "@owarine/core/types";
import { z } from "zod";
import type { SeatSigner } from "../sessions/seat-signer";
import { ledgerRequest, type LedgerCallResult } from "./ledger-api";

/** A lease request is good for five minutes, so a captured one cannot be replayed later. */
export const SEAT_LEASE_TTL_MS = 5 * 60_000;

/** The text a seat signs to take (or keep) a guest seat. Written to be read: it grants a seat, nothing else. */
export function seatLeaseText(address: Address, issuedAtMs: number, cluster: Cluster): string {
  return [
    `${SIGNED_MESSAGE_BRAND} guest seat`,
    "",
    "This signature asks for a guest seat for this browser key: a practice party on the ledger, funded with demo credits. It cannot move money anywhere else.",
    "",
    `Seat: ${address}`,
    `Issued at: ${new Date(issuedAtMs).toISOString()}`,
    networkLine(cluster),
  ].join("\n");
}

export const seatLeaseRequestWire = z.strictObject({
  address: z.string(),
  issuedAtMs: z.number().int(),
  signature: z.string(),
});

export const seatLeaseWire = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("leased"),
    leaseId: z.string(),
    address: z.string(),
    /** The Canton party this seat acts as: shown as a second fact in the account modal and the "who can see this" chip. */
    party: z.string(),
    leasedAtMs: z.number(),
    /** When the idle clock would free the seat if nothing renews it (deferred while it holds an open leg). */
    idleExpiresAtMs: z.number(),
    hardCapAtMs: z.number(),
    openLegs: z.number().int(),
    funded: z.boolean(),
  }),
  z.object({ kind: z.literal("pool-full"), total: z.number().int(), inUse: z.number().int(), nextFreeAtMs: z.number().nullable(), position: z.number().int() }),
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("not-live"), reason: z.string() }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type SeatLeaseView = z.output<typeof seatLeaseWire>;

/** Take or renew the seat's lease: the seat key signs a fresh lease text; the answer sets the HttpOnly seat cookie. */
export async function leaseSeat(signer: SeatSigner, cluster: Cluster, nowMs: number = Date.now()): Promise<LedgerCallResult<SeatLeaseView>> {
  const signature = encodeBase58(await signer.signMessage(messageBytes(seatLeaseText(signer.address, nowMs, cluster))));
  return ledgerRequest("/seat", { method: "POST", body: { address: signer.address, issuedAtMs: nowMs, signature }, wire: seatLeaseWire, seat: false, root: true, okStatuses: [409] });
}

/** The lease this browser (cookie) or this seat key (signed header) holds now. */
export function readSeatLease(): Promise<LedgerCallResult<SeatLeaseView>> {
  return ledgerRequest("/seat", { method: "GET", wire: seatLeaseWire, root: true });
}

/** Let the seat go ("Reset seat"): the server drains it, and the cookie is cleared. */
export function releaseSeat(): Promise<LedgerCallResult<SeatLeaseView>> {
  return ledgerRequest("/seat", { method: "DELETE", wire: seatLeaseWire, root: true });
}
