import { openXSignIn } from "~/lib/external";
import { appUrl } from "~/lib/identity";
import { setForwardedXSession } from "./x-session";

/**
 * Sign in with X on the phone (C13a: `/native-auth` closes the reference's open native X gate; C4d M2a, K-212). The web
 * runs the ordinary X sign-in inside an auth session (ASWebAuthenticationSession); the person confirms there, and the
 * web answers on this app's own scheme with a one-time code: `<scheme>://x-auth?code=&state=`. The app opened the
 * handoff with a PKCE S256 challenge of a verifier it keeps to itself, and trades code + verifier for the signed X
 * session over POST (`/api/x/native-exchange`): an app that catches the redirect without the verifier gets nothing.
 * The return URL is `appUrl` (the app identity's scheme, K-126; never spelled here), and `state` is a fresh nonce this
 * app checks, so a handoff this app did not start is ignored.
 */
export type XSignInResult = { ok: true } | { ok: false; reason: "cancelled" | "state" | "config" | "denied" | "token" | "server" };

const REASONS = new Set(["state", "config", "denied", "token", "server"]);
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A PKCE pair (RFC 7636): a 32-byte random verifier as base64url, and its S256 challenge. */
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge: base64url(digest) };
}

/** The query of a callback URL on the app's scheme (`x-auth?a=b`), without relying on `URL` for a custom scheme. */
function queryOf(url: string): URLSearchParams {
  const at = url.indexOf("?");
  return new URLSearchParams(at === -1 ? "" : url.slice(at + 1).split("#")[0]);
}

/** The code and verifier traded for the session; null when the web refuses (expired, used, wrong verifier). */
async function exchange(code: string, verifier: string): Promise<string | null> {
  try {
    const res = await fetch("/api/x/native-exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, verifier }) });
    const body = (await res.json().catch(() => null)) as { session?: unknown } | null;
    return res.ok && typeof body?.session === "string" ? body.session : null;
  } catch {
    return null;
  }
}

export async function signInWithX(): Promise<XSignInResult> {
  const state = hex(crypto.getRandomValues(new Uint8Array(16)));
  const { verifier, challenge } = await pkcePair();
  const returnUrl = appUrl("x-auth");
  const result = await openXSignIn(state, challenge, returnUrl);
  if (result.type !== "success") return { ok: false, reason: "cancelled" };
  const q = queryOf(result.url);
  if (q.get("state") !== state) return { ok: false, reason: "state" };
  const code = q.get("code");
  if (code) {
    const session = await exchange(code, verifier);
    if (!session) return { ok: false, reason: "token" };
    await setForwardedXSession(session);
    return { ok: true };
  }
  const error = q.get("error") ?? "server";
  return { ok: false, reason: (REASONS.has(error) ? error : "server") as Exclude<XSignInResult, { ok: true }>["reason"] };
}
