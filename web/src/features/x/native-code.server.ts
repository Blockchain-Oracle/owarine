import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The one-time codes of the app's X sign-in handoff (C4d M2a, K-212; `native-handoff.ts`). A code is 32 random bytes,
 * good for 60 seconds and for ONE exchange, and only with the verifier whose S256 challenge the app opened the handoff
 * with. It maps to the signed X session the confirming browser holds; the session never leaves in a URL.
 *
 * Codes live in this process's memory (`globalThis`, so every route module sees one map), which is every replica the
 * single web container has; a code the app does not redeem in time simply lapses.
 */
export const NATIVE_CODE_TTL_MS = 60_000;

interface Pending {
  session: string;
  challenge: string;
  expiresAtMs: number;
}
const store: Map<string, Pending> = ((globalThis as { __agariNativeCodes?: Map<string, Pending> }).__agariNativeCodes ??= new Map());

const prune = (nowMs: number) => {
  for (const [code, p] of store) if (p.expiresAtMs <= nowMs) store.delete(code);
};

/** S256: base64url SHA-256 of the verifier (RFC 7636 §4.2). */
export const challengeOf = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url");

export function issueNativeCode(i: { session: string; challenge: string; nowMs: number }): string {
  prune(i.nowMs);
  const code = randomBytes(32).toString("base64url");
  store.set(code, { session: i.session, challenge: i.challenge, expiresAtMs: i.nowMs + NATIVE_CODE_TTL_MS });
  return code;
}

/**
 * The session for `code`, once, within its minute, and only with the right verifier. A wrong verifier burns the code
 * too, so a code caught on its way to the app cannot be tried against guesses.
 */
export function redeemNativeCode(i: { code: string; verifier: string; nowMs: number }): string | null {
  prune(i.nowMs);
  const pending = store.get(i.code);
  if (!pending) return null;
  store.delete(i.code);
  const want = Buffer.from(pending.challenge);
  const got = Buffer.from(challengeOf(i.verifier));
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return pending.session;
}
