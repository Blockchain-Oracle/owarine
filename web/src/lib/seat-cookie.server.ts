import { createHmac, timingSafeEqual } from "node:crypto";
import { isAddress, type Address } from "@agari/core/types";

/**
 * The seat cookie (research 05 §A): `leaseId.address.expiry.mac`, HttpOnly, SameSite=Lax, the MAC built the way the
 * room's `mintToken` builds its own (HMAC-SHA256, base64url, constant-time compare). It proves which lease this browser
 * took; the lease row it names is still checked on every call, so a released or recycled seat stops answering at once.
 * Base58 and UUIDs contain no dot, so the value splits unambiguously.
 */
export const SEAT_COOKIE = "agari_seat";
/** The cookie outlives an idle lease on purpose: the row, not the cookie, says whether the seat is still this browser's. */
export const SEAT_COOKIE_TTL_MS = 24 * 3_600_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface SeatCookie {
  leaseId: string;
  address: Address;
  expiresAtMs: number;
}

const mac = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function mintSeatCookie(secret: string, leaseId: string, address: Address, nowMs: number): { value: string; expiresAtMs: number } {
  const expiresAtMs = nowMs + SEAT_COOKIE_TTL_MS;
  const payload = `${leaseId}.${address}.${expiresAtMs}`;
  return { value: `${payload}.${mac(secret, payload)}`, expiresAtMs };
}

/** The lease this cookie names, or null for anything forged, expired or malformed. Never throws on input. */
export function readSeatCookie(secret: string, value: string | null | undefined, nowMs: number): SeatCookie | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [leaseId, address, expiry, given] = parts as [string, string, string, string];
  if (!UUID_RE.test(leaseId) || !isAddress(address) || !/^\d{1,16}$/.test(expiry)) return null;
  const expected = Buffer.from(mac(secret, `${leaseId}.${address}.${expiry}`));
  const got = Buffer.from(given);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const expiresAtMs = Number(expiry);
  if (expiresAtMs <= nowMs) return null;
  return { leaseId, address, expiresAtMs };
}

/** The seat cookie's value from a `Cookie` header (route handlers and `seatCaller` read raw headers). */
export function seatCookieFrom(headers: Headers): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SEAT_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
