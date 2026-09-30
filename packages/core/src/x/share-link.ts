import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { MarketId } from "../types/ids";
import type { Side } from "../types/market";
import { DIRECTION_PARAM, marketPath } from "../urls/app";

/**
 * A signed Window share link (C13a): what a Blink hands out on Canton. Solana Actions built a transaction for a
 * stranger's wallet; a Canton seat trades only through its own lease, so the Action's POST now answers with a link
 * that opens this Window's ticket on the web or, through the same https path (a universal link), in the app:
 *
 *   <origin>/markets/<marketId>?dir=<up|down>&stake=<base units>&exp=<unix s>&sig=<hex>
 *
 * The venue signs it (HMAC-SHA256 under a key only the web server holds), so the stake a stranger's link carries is
 * one the venue checked against that Window's floor when it issued the link, and a link edited by hand (another
 * Window, side or amount) loses its stake and opens as a plain deep link. The signature covers the Window, the side,
 * the stake and the expiry; nothing in it names or authorises a seat.
 *
 * Pure: the key is passed in. The server derives it from its own secret with `shareKeyFrom`.
 */
export const SHARE_STAKE_PARAM = "stake";
export const SHARE_EXPIRES_PARAM = "exp";
export const SHARE_SIG_PARAM = "sig";

const DOMAIN = "window-share-link:v1";

export interface WindowShare {
  marketId: MarketId;
  side: Side;
  stakeBase: bigint;
  /** The link's stake is honoured until this second: the Window's close. The page still opens after it. */
  expiresSec: number;
}

/** The share key, derived from a server secret with a label of its own, so it is never the secret itself. */
export function shareKeyFrom(secret: string): Uint8Array {
  return hmac(sha256, utf8ToBytes(secret), utf8ToBytes(DOMAIN));
}

function shareText(s: WindowShare): string {
  return [DOMAIN, s.marketId, s.side, s.stakeBase.toString(), String(s.expiresSec)].join("\n");
}

export function signWindowShare(key: Uint8Array, s: WindowShare): string {
  return bytesToHex(hmac(sha256, key, utf8ToBytes(shareText(s))));
}

/** The absolute link. `origin` has no trailing slash. */
export function windowShareUrl(origin: string, s: WindowShare, sig: string): string {
  const q = new URLSearchParams({
    [DIRECTION_PARAM]: s.side,
    [SHARE_STAKE_PARAM]: s.stakeBase.toString(),
    [SHARE_EXPIRES_PARAM]: String(s.expiresSec),
    [SHARE_SIG_PARAM]: sig,
  });
  return `${origin}${marketPath(s.marketId)}?${q.toString()}`;
}

/** Equal-length hex compared without an early exit. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const BASE_UNITS = /^[1-9]\d{0,30}$/;
const SECONDS = /^\d{1,12}$/;

/**
 * The share a link carries, when its signature holds for this Window and it has not expired; null otherwise (a plain
 * deep link, an edited one, or one past its Window). `get` reads one query parameter.
 */
export function readWindowShare(key: Uint8Array, marketId: MarketId, get: (name: string) => string | null | undefined, nowSec: number): WindowShare | null {
  const side = get(DIRECTION_PARAM);
  const stake = get(SHARE_STAKE_PARAM);
  const exp = get(SHARE_EXPIRES_PARAM);
  const sig = get(SHARE_SIG_PARAM);
  if ((side !== "up" && side !== "down") || !stake || !BASE_UNITS.test(stake) || !exp || !SECONDS.test(exp) || !sig || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const share: WindowShare = { marketId, side, stakeBase: BigInt(stake), expiresSec: Number(exp) };
  if (!sameHex(signWindowShare(key, share), sig)) return null;
  return share.expiresSec > nowSec ? share : null;
}
