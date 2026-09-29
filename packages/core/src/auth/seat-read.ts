import type { Cluster } from "../constants/chain";
import { isAddress, isEd25519Signature, type Address, type Signature } from "../types/primitives";
import { networkLine, SIGNED_MESSAGE_BRAND } from "./signed-message";

/**
 * The short-lived proof a seat sends to read its own private rows (`/api/index/wallet/<address>/*`, plan §5): the seat
 * key signs this text, and the header carries `address.issuedAtMs.signature`. Base58 never contains a dot, so the header
 * splits unambiguously. From C4 the seat cookie also authorises these reads; the header stays for the iOS app, which
 * sends a signed seat header rather than a cookie.
 */
export const SEAT_READ_HEADER = "x-agari-seat-read";
/** A read proof is good for five minutes, so a captured header cannot be replayed later (the X link's rule). */
export const SEAT_READ_TTL_MS = 5 * 60_000;
/** Clock skew allowed for a proof issued slightly in the future. */
export const SEAT_READ_SKEW_MS = 30_000;

export interface SeatReadProof {
  address: Address;
  issuedAtMs: number;
  signature: Signature;
}

/** The text a seat signs to read its own history. Written to be read: it grants reads, and nothing else. */
export function seatReadText(address: Address, issuedAtMs: number, cluster: Cluster): string {
  return [
    `${SIGNED_MESSAGE_BRAND} seat read`,
    "",
    "This signature lets this browser read my seat's own fills, positions, actions and orders for five minutes. It cannot place, move or cancel anything.",
    "",
    `Seat: ${address}`,
    `Issued at: ${new Date(issuedAtMs).toISOString()}`,
    networkLine(cluster),
  ].join("\n");
}

export function formatSeatReadHeader(proof: SeatReadProof): string {
  return `${proof.address}.${proof.issuedAtMs}.${proof.signature}`;
}

/** Null for anything that is not `address.issuedAtMs.signature` with a base58 address and signature. */
export function parseSeatReadHeader(value: string | null | undefined): SeatReadProof | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [address, issued, signature] = parts as [string, string, string];
  if (!/^\d{1,16}$/.test(issued) || !isAddress(address) || !isEd25519Signature(signature)) return null;
  return { address, issuedAtMs: Number(issued), signature };
}

/** Whether a proof's issue time is inside its five-minute window at `nowMs`. */
export function seatReadFresh(issuedAtMs: number, nowMs: number): boolean {
  return issuedAtMs <= nowMs + SEAT_READ_SKEW_MS && nowMs - issuedAtMs <= SEAT_READ_TTL_MS;
}
