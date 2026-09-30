/**
 * The seat link between devices (plan, iOS step 2b): the web's seat key and the phone's Keychain key are different keys,
 * so one seat on both needs a signed pairing. The device that holds the lease asks for a one-time code (60 s, single
 * use); the other device's key signs a join text naming that code, and the holder's device allows it (C4c, security
 * review L1) before the server adds that key to the same lease. Either device ends the link by resetting its seat (the
 * joined key leaves; the holder's reset drains the seat).
 */
import { messageBytes, networkLine, SIGNED_MESSAGE_BRAND } from "@agari/core/auth";
import type { Cluster } from "@agari/core/constants";
import { encodeBase58, type Address } from "@agari/core/types";
import { z } from "zod";
import type { SeatSigner } from "../sessions/seat-signer";
import { ledgerRequest, type LedgerCallResult } from "./ledger-api";
import { seatLeaseWire, SEAT_LEASE_TTL_MS, type SeatLeaseView } from "./seat";

/** A code works for this long, once. */
export const SEAT_LINK_TTL_MS = 60_000;
/** C4c (review L1): eight characters over 31 (31^8 ≈ 8.5 × 10^11), up from six. */
export const SEAT_LINK_CODE_LENGTH = 8;
/** How long a used code waits for the holder's device to allow the joining key; the join answers within it. */
export const SEAT_LINK_CONFIRM_MS = 45_000;

/** A code as shown and read aloud: two groups of four. */
export const formatSeatLinkCode = (code: string): string => `${code.slice(0, SEAT_LINK_CODE_LENGTH / 2)} ${code.slice(SEAT_LINK_CODE_LENGTH / 2)}`;
/** Letters and digits a person cannot confuse when copying from another screen (no 0/O, 1/I/L). */
export const SEAT_LINK_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** A join request is good as long as a lease request. */
export const SEAT_LINK_JOIN_TTL_MS = SEAT_LEASE_TTL_MS;

/** The code as typed: case, spaces and dashes forgiven; null unless it is a well-formed code. */
export function normalizeSeatLinkCode(text: string): string | null {
  const code = text.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== SEAT_LINK_CODE_LENGTH) return null;
  return [...code].every((c) => SEAT_LINK_ALPHABET.includes(c)) ? code : null;
}

/** The deep link a QR carries into the app: `<scheme>://seat/link?code=…` (the app's scheme is the caller's). */
export const seatLinkPath = (code: string) => `seat/link?code=${code}`;

/** The text a device's seat key signs to join another device's seat. Written to be read: it joins, nothing else. */
export function seatLinkText(address: Address, code: string, issuedAtMs: number, cluster: Cluster): string {
  return [
    `${SIGNED_MESSAGE_BRAND} seat link`,
    "",
    "This signature adds this device's key to the guest seat that showed this code. Both devices then use that seat's demo credits and calls. It cannot move money anywhere else.",
    "",
    `Code: ${code}`,
    `Seat key: ${address}`,
    `Issued at: ${new Date(issuedAtMs).toISOString()}`,
    networkLine(cluster),
  ].join("\n");
}

export const seatLinkCodeWire = z.object({ code: z.string(), expiresAtMs: z.number() });
export type SeatLinkCode = z.output<typeof seatLinkCodeWire>;

export const seatLinkJoinWire = z.strictObject({
  code: z.string(),
  address: z.string(),
  issuedAtMs: z.number().int(),
  signature: z.string(),
});

/** A fresh code for the seat this device holds (cookie on web, signed seat header on the phone). */
export function createSeatLink(): Promise<LedgerCallResult<SeatLinkCode>> {
  return ledgerRequest("/seat/link", { method: "POST", wire: seatLinkCodeWire, root: true });
}

/**
 * Where the code this seat showed stands: still showing, ran out, used by a device that waits for this one to allow it
 * (`pending`, naming that device's key), allowed (`linked`), or refused here (`declined`).
 */
export const seatLinkStateWire = z.object({ state: z.enum(["showing", "expired", "pending", "linked", "declined"]), device: z.string().nullable().optional() });
export type SeatLinkCodeState = z.output<typeof seatLinkStateWire>["state"];
export type SeatLinkReading = { state: SeatLinkCodeState; device: string | null };

export function readSeatLink(code: string): Promise<LedgerCallResult<SeatLinkReading>> {
  return ledgerRequest("/seat/link", { method: "GET", wire: seatLinkStateWire, root: true, query: { code } }).then((r) => (r.ok ? { ok: true, value: { state: r.value.state, device: r.value.device ?? null } } : r));
}

export const seatLinkDecisionWire = z.object({ state: z.enum(["linked", "declined"]) });

/** The holder's answer to a device waiting on its code: allow it onto this seat, or refuse it. */
export function decideSeatLink(code: string, allow: boolean): Promise<LedgerCallResult<z.output<typeof seatLinkDecisionWire>>> {
  return ledgerRequest("/seat/link/confirm", { method: "POST", body: { code, allow }, wire: seatLinkDecisionWire, root: true });
}

/**
 * Joins the seat that showed `code` with this device's key; answers the joined lease (and, on web, sets the cookie) once
 * the holder's device allows it, or a refusal when it declines or does not answer within `SEAT_LINK_CONFIRM_MS`.
 */
export async function joinSeatLink(signer: SeatSigner, code: string, cluster: Cluster, nowMs: number = Date.now()): Promise<LedgerCallResult<SeatLeaseView>> {
  const signature = encodeBase58(await signer.signMessage(messageBytes(seatLinkText(signer.address, code, nowMs, cluster))));
  return ledgerRequest("/seat/link/join", { method: "POST", body: { code, address: signer.address, issuedAtMs: nowMs, signature }, wire: seatLeaseWire, seat: false, root: true });
}
