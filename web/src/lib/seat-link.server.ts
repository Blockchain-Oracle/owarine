import "server-only";
import { randomInt } from "node:crypto";
import { isAddress, isEd25519Signature, type Address } from "@owarine/core/types";
import { normalizeSeatLinkCode, SEAT_LINK_ALPHABET, SEAT_LINK_CODE_LENGTH, SEAT_LINK_JOIN_TTL_MS, SEAT_LINK_TTL_MS, seatLinkJoinWire, seatLinkText } from "@owarine/markets";
import { verifyWalletMessage } from "./auth/verify-signed-message.server";
import { webEnv } from "./env";
import type { SeatServer } from "./ledger.server";
import type { LeaseRow } from "./seat-store.server";

/**
 * The server half of the seat link (plan, iOS step 2b): the leased device asks for a one-time code, the other device's
 * key signs `seatLinkText` naming it, and once the holder's device allows it the key joins the same lease
 * (`seat_linked_keys`). Codes come from the OS CSPRNG over 31 unambiguous characters, eight of them (31^8 ≈ 8.5 × 10^11,
 * C4c), live 60 s and work once; the join route is rate-limited per IP (IPv6 per /64), and every miss counts against
 * every live code (locked after `LINK_CODE_MAX_FAILURES`), so guessing a live code is out of reach from any number of
 * addresses, and a correct guess still needs the holder to allow it.
 */

/** Codes one seat may ask for per minute: "Show a new code" is a tap, not a loop. */
export const LINK_CODES_PER_MINUTE = 6;

export function newSeatLinkCode(): string {
  let code = "";
  for (let i = 0; i < SEAT_LINK_CODE_LENGTH; i += 1) code += SEAT_LINK_ALPHABET[randomInt(SEAT_LINK_ALPHABET.length)];
  return code;
}

export type IssueOutcome = { ok: true; code: string; expiresAtMs: number } | { ok: false; reason: string };

/** A fresh code for this lease (the caller proved the seat with its cookie or signed header). */
export async function issueSeatLink(server: SeatServer, lease: LeaseRow, nowMs: number): Promise<IssueOutcome> {
  if ((await server.store.links.issuedSince(lease.leaseId, nowMs - 60_000)) >= LINK_CODES_PER_MINUTE) return { ok: false, reason: "too many codes for this seat; wait a minute" };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = newSeatLinkCode();
    if (await server.store.links.issue(lease.leaseId, code, nowMs, SEAT_LINK_TTL_MS)) return { ok: true, code, expiresAtMs: nowMs + SEAT_LINK_TTL_MS };
  }
  return { ok: false, reason: "could not draw a free code; try again" };
}

export type JoinCheck = { ok: true; address: Address; code: string } | { ok: false; reason: string };

/** The signed body `{code, address, issuedAtMs, signature}`: a fresh `seatLinkText` signed by that address's key. */
export async function checkJoinRequest(body: unknown, nowMs: number): Promise<JoinCheck> {
  const parsed = seatLinkJoinWire.safeParse(body);
  if (!parsed.success) return { ok: false, reason: "expected {code, address, issuedAtMs, signature}" };
  const { address, issuedAtMs, signature } = parsed.data;
  const code = normalizeSeatLinkCode(parsed.data.code);
  if (!code) return { ok: false, reason: `a link code is ${SEAT_LINK_CODE_LENGTH} letters and numbers` };
  if (!isAddress(address) || !isEd25519Signature(signature)) return { ok: false, reason: "malformed address or signature" };
  if (issuedAtMs > nowMs + 30_000 || nowMs - issuedAtMs > SEAT_LINK_JOIN_TTL_MS) return { ok: false, reason: "the join request is stale; sign a fresh one" };
  const text = seatLinkText(address, code, issuedAtMs, webEnv.markets.cluster);
  const valid = await verifyWalletMessage({ text, signature, signer: address });
  return valid ? { ok: true, address, code } : { ok: false, reason: "the signature is not this key's" };
}
