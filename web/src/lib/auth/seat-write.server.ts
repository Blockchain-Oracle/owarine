import { bodySha256, parseSeatWriteHeader, SEAT_WRITE_HEADER, SEAT_WRITE_TTL_MS, SEAT_WRITE_SKEW_MS, seatWriteFresh, seatWriteText } from "@owarine/core/auth";
import type { Cluster } from "@owarine/core/constants";
import type { Address } from "@owarine/core/types";
import { verifyWalletMessage } from "./verify-signed-message.server";

/**
 * The server half of the phone's per-write proof (C4d M2b; `@owarine/core/auth` `seat-write.ts`): the seat that signed
 * THIS request (its method, path with query, body bytes), within 30 seconds, once. The body is read from a clone and
 * kept per request (`requestText`), so a route that reads it afterwards, or read it before, sees the same bytes.
 *
 * Nonces live in this process's memory until their proof goes stale (TTL + skew); the web runs as one container, so
 * one map is every replica there is. A second process would need a shared store (K-211).
 */
const texts = new WeakMap<Request, Promise<string | null>>();

/** The request's body text, read once from a clone and remembered; null when it was already consumed elsewhere. */
export function requestText(request: Request): Promise<string | null> {
  let text = texts.get(request);
  if (!text) {
    text = request.bodyUsed ? Promise.resolve(null) : request.clone().text().catch(() => null);
    texts.set(request, text);
  }
  return text;
}

interface NonceCache {
  seen: Map<string, number>;
}
const cache: NonceCache = ((globalThis as { __agariSeatWriteNonces?: NonceCache }).__agariSeatWriteNonces ??= { seen: new Map() });
const KEEP_MS = SEAT_WRITE_TTL_MS + SEAT_WRITE_SKEW_MS;

/** A ceiling on remembered nonces: past it a write is refused rather than the map growing without bound. */
const MAX_NONCES = 200_000;

/** True the first time a nonce is offered while it could still be fresh; false for every replay. */
export function takeNonce(key: string, nowMs: number): boolean {
  // Entries go in with a fixed lifetime, so the map is in expiry order: stop at the first live one.
  for (const [k, until] of cache.seen) {
    if (until > nowMs) break;
    cache.seen.delete(k);
  }
  if (cache.seen.has(key) || cache.seen.size >= MAX_NONCES) return false;
  cache.seen.set(key, nowMs + KEEP_MS);
  return true;
}

/**
 * The seat address that signed this exact write, or null. Never throws on input. `admit` (the seat store's "does this
 * key hold a live lease") runs before the nonce is spent, so a proof from a self-made key cannot fill the nonce map.
 */
export async function seatWriter(request: Request, cluster: Cluster, nowMs: number = Date.now(), admit?: (address: Address) => Promise<boolean>): Promise<Address | null> {
  const proof = parseSeatWriteHeader(request.headers.get(SEAT_WRITE_HEADER));
  if (!proof || !seatWriteFresh(proof.issuedAtMs, nowMs)) return null;
  const body = await requestText(request);
  if (body === null) return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const text = seatWriteText({ address: proof.address, issuedAtMs: proof.issuedAtMs, nonce: proof.nonce, method: request.method, path: `${url.pathname}${url.search}`, bodySha256: bodySha256(body) }, cluster);
  if (!(await verifyWalletMessage({ text, signature: proof.signature, signer: proof.address }))) return null;
  // Only a proof that verified, from a key that holds a seat, can spend a nonce, so a stranger cannot burn a seat's
  // nonces or grow the map.
  if (admit && !(await admit(proof.address))) return null;
  return takeNonce(`${proof.address}.${proof.nonce}`, nowMs) ? proof.address : null;
}
