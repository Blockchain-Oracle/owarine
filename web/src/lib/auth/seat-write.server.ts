import { bodySha256, parseSeatWriteHeader, SEAT_WRITE_HEADER, SEAT_WRITE_TTL_MS, SEAT_WRITE_SKEW_MS, seatWriteFresh, seatWriteText } from "@agari/core/auth";
import type { Cluster } from "@agari/core/constants";
import type { Address } from "@agari/core/types";
import { verifyWalletMessage } from "./verify-signed-message.server";

/**
 * The server half of the phone's per-write proof (C4d M2b; `@agari/core/auth` `seat-write.ts`): the seat that signed
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

/** True the first time a nonce is offered while it could still be fresh; false for every replay. */
export function takeNonce(key: string, nowMs: number): boolean {
  for (const [k, until] of cache.seen) if (until <= nowMs) cache.seen.delete(k);
  if (cache.seen.has(key)) return false;
  cache.seen.set(key, nowMs + KEEP_MS);
  return true;
}

/** The seat address that signed this exact write, or null. Never throws on input. */
export async function seatWriter(request: Request, cluster: Cluster, nowMs: number = Date.now()): Promise<Address | null> {
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
  // Only a proof that verified can spend a nonce, so a stranger cannot burn a seat's nonces.
  return takeNonce(`${proof.address}.${proof.nonce}`, nowMs) ? proof.address : null;
}
