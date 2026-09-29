/**
 * The web → ops internal call's authentication (plan §3: quote issuance goes web → ops over HMAC, so venue authority is
 * never exercised from the web tier). Both halves live here so the web's route handler and ops sign and check the same
 * bytes:
 *
 *   x-agari-ts:  unix seconds when the request was signed
 *   x-agari-sig: hex HMAC-SHA256(secret, `${method}\n${path}\n${ts}\n${body}`)
 *
 * A request older or newer than `MAX_SKEW_SEC` is refused, so a captured request cannot be replayed later. The secret is
 * `OPS_INTERNAL_SECRET`, server-only on both hosts, at least 32 characters.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const INTERNAL_TS_HEADER = "x-agari-ts";
export const INTERNAL_SIG_HEADER = "x-agari-sig";
export const MAX_SKEW_SEC = 30;
export const MIN_SECRET_LENGTH = 32;

const mac = (secret: string, method: string, path: string, ts: string, body: string) =>
  createHmac("sha256", secret).update(`${method.toUpperCase()}\n${path}\n${ts}\n${body}`).digest("hex");

/** The two headers for a request (the web's side). */
export function signInternalRequest(secret: string, method: string, path: string, body: string, nowSec = Math.floor(Date.now() / 1000)): Record<string, string> {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`OPS_INTERNAL_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  const ts = String(nowSec);
  return { [INTERNAL_TS_HEADER]: ts, [INTERNAL_SIG_HEADER]: mac(secret, method, path, ts, body) };
}

export type InternalAuthResult = { ok: true } | { ok: false; reason: "missing" | "skew" | "signature" };

/** Checks a request (ops' side). Constant-time on the signature. */
export function verifyInternalRequest(
  secret: string,
  method: string,
  path: string,
  body: string,
  headers: { ts: string | undefined; sig: string | undefined },
  nowSec = Math.floor(Date.now() / 1000),
): InternalAuthResult {
  if (!headers.ts || !headers.sig || !/^\d{1,12}$/.test(headers.ts) || !/^[0-9a-f]{64}$/.test(headers.sig)) return { ok: false, reason: "missing" };
  if (Math.abs(nowSec - Number(headers.ts)) > MAX_SKEW_SEC) return { ok: false, reason: "skew" };
  const want = Buffer.from(mac(secret, method, path, headers.ts, body), "hex");
  const got = Buffer.from(headers.sig, "hex");
  return want.length === got.length && timingSafeEqual(want, got) ? { ok: true } : { ok: false, reason: "signature" };
}
