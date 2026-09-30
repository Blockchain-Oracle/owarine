import { openXSignIn } from "~/lib/external";
import { appUrl } from "~/lib/identity";
import { setForwardedXSession } from "./x-session";

/**
 * Sign in with X on the phone (C13a: `/native-auth` closes the reference's open native X gate). The web runs the
 * ordinary X sign-in inside an auth session (ASWebAuthenticationSession), then hands the signed X session back on this
 * app's own scheme: `<scheme>://x-auth?session=&state=`. The return URL is `appUrl` (the app identity's scheme,
 * K-126; never spelled here), and `state` is a fresh nonce this app checks, so a handoff this app did not start is ignored.
 */
export type XSignInResult = { ok: true } | { ok: false; reason: "cancelled" | "state" | "config" | "denied" | "token" | "server" };

const REASONS = new Set(["state", "config", "denied", "token", "server"]);
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** The query of a callback URL on the app's scheme (`x-auth?a=b`), without relying on `URL` for a custom scheme. */
function queryOf(url: string): URLSearchParams {
  const at = url.indexOf("?");
  return new URLSearchParams(at === -1 ? "" : url.slice(at + 1).split("#")[0]);
}

export async function signInWithX(): Promise<XSignInResult> {
  const state = hex(crypto.getRandomValues(new Uint8Array(16)));
  const returnUrl = appUrl("x-auth");
  const result = await openXSignIn(state, returnUrl);
  if (result.type !== "success") return { ok: false, reason: "cancelled" };
  const q = queryOf(result.url);
  if (q.get("state") !== state) return { ok: false, reason: "state" };
  const session = q.get("session");
  if (session) {
    await setForwardedXSession(session);
    return { ok: true };
  }
  const error = q.get("error") ?? "server";
  return { ok: false, reason: (REASONS.has(error) ? error : "server") as Exclude<XSignInResult, { ok: true }>["reason"] };
}
