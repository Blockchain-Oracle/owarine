import "server-only";
import { readWindowShare, shareKeyFrom, type WindowShare } from "@owarine/core/x";
import type { MarketId } from "@owarine/core/types";

/**
 * The key a Window share link is signed with (C13a, Blinks on Canton), derived from the seat cookie's secret under a
 * label of its own (`shareKeyFrom`), so it needs no new variable and is never the secret itself. Null on a host with
 * no seat secret: the Blink's POST then answers `not-deployed`, and a shared link opens as a plain deep link.
 */
let cached: { secret: string; key: Uint8Array } | null = null;

export function windowShareKey(): Uint8Array | null {
  const secret = process.env.OWARINE_SEAT_COOKIE_SECRET;
  if (!secret || secret.length < 32) return null;
  if (cached?.secret !== secret) cached = { secret, key: shareKeyFrom(secret) };
  return cached.key;
}

/** The share a `/markets/<id>` link carries when its signature holds and its Window has not closed. */
export function verifiedWindowShare(marketId: MarketId, params: Record<string, string | string[] | undefined>, nowSec: number): WindowShare | null {
  const key = windowShareKey();
  if (!key) return null;
  const get = (name: string) => {
    const v = params[name];
    return typeof v === "string" ? v : null;
  };
  return readWindowShare(key, marketId, get, nowSec);
}
