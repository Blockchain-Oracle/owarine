import type { Address } from "@agari/core/types";
import { webEnv } from "../env";
import { readSeatCookie, seatCookieFrom } from "../seat-cookie.server";
import { seatCaller } from "./seat-caller.server";
import { seatWriter } from "./seat-write.server";

/**
 * Address-keyed routes (C4d M3): a row keyed by a seat address is that visitor's own (the address is their own key,
 * never recycled), so the one question is whether the caller proves that address. `?address=` alone proves nothing.
 */

const hostOf = (origin: string): string | null => {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
};

/** True when the caller proves `address` (the seat cookie, or the phone's signed read header). */
export async function provesAddress(request: Request, address: string): Promise<boolean> {
  return (await seatCaller(request.headers, webEnv.markets.cluster)) === address;
}

/**
 * The seat a POST comes from: the seat cookie (SameSite=Lax, so a cross-site post never carries it; an Origin, when
 * sent, must be ours), or the phone's one-request write proof. Never the reusable read header.
 */
export async function provenWriter(request: Request): Promise<Address | null> {
  const secret = process.env.AGARI_SEAT_COOKIE_SECRET;
  const cookie = secret && secret.length >= 32 ? readSeatCookie(secret, seatCookieFrom(request.headers), Date.now()) : null;
  if (cookie) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const ours = origin === null || origin === webEnv.appOrigin || (host !== null && hostOf(origin) === host);
    if (ours) return cookie.address;
  }
  return seatWriter(request, webEnv.markets.cluster);
}
