/**
 * The X sign-in handoff into the app (plan: `/native-auth` "gets a job", C13a; hardened C4d M2a, K-212). The phone
 * opens `/native-auth?state=&challenge=` in an auth session (ASWebAuthenticationSession): `state` is its nonce and
 * `challenge` the base64url SHA-256 of a secret verifier only the app holds (PKCE, S256). The web runs the ordinary X
 * sign-in; once signed in, the person confirms on the page ("Continue in the app as @handle"), and the confirmation
 * (a same-site POST, `/api/x/native-code`) sends the app a one-time code on its own scheme, `<scheme>://x-auth?code=
 * &state=`, good for 60 seconds. The app trades code + verifier for the session over POST (`/api/x/native-exchange`).
 *
 * So the session itself never travels in a URL, an app that catches the redirect without the verifier gets nothing,
 * and no page load alone, from any app's auth session, hands a signed-in person's X session out without their tap.
 * This file decides the next step; the page supplies the app's scheme (never spelled here) and the session state.
 */
export const NATIVE_X_AUTH_PATH = "x-auth";
export const NATIVE_STATE_PARAM = "state";
export const NATIVE_CHALLENGE_PARAM = "challenge";

/** The app's nonce: 16 to 64 random bytes as lowercase hex. */
const STATE = /^[0-9a-f]{32,128}$/;
export const isHandoffState = (s: string | null | undefined): s is string => typeof s === "string" && STATE.test(s);
/** A PKCE S256 challenge: base64url SHA-256, 43 characters, no padding. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
export const isHandoffChallenge = (s: string | null | undefined): s is string => typeof s === "string" && CHALLENGE.test(s);
/** A PKCE verifier: 43 to 128 unreserved characters (RFC 7636 §4.1). */
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
export const isHandoffVerifier = (s: string | null | undefined): s is string => typeof s === "string" && VERIFIER.test(s);

/** Why the X sign-in did not finish, as the callback names it (`x_reason`), kept to known words. */
const REASONS = new Set(["config", "denied", "state", "token", "profile", "server"]);

export type NativeHandoffStep =
  /** Not from the app (no nonce or no challenge): the page explains, it never redirects into an app scheme. */
  | { kind: "page" }
  /** Not signed in yet: run the ordinary X sign-in, coming back here with the same nonce and challenge. */
  | { kind: "begin"; to: string }
  /** Signed in: the person confirms before anything goes to the app (the page's form posts these back). */
  | { kind: "consent"; handle: string | null; state: string; challenge: string }
  /** Failed: this path on the app's scheme (`x-auth?error=…`). Never carries a session. */
  | { kind: "app"; path: string };

export interface NativeHandoffInput {
  state: string | null;
  challenge: string | null;
  /** The callback's `x` (1 or err) and `x_reason`. */
  result: string | null;
  reason: string | null;
  /** Whether X sign-in is configured on this host. */
  configured: boolean;
  /** The X session this browser holds (its handle), if any. */
  session: { handle: string | null } | null;
}

/** The app's return path with a one-time code (the confirmation's redirect). */
export function nativeCodePath(code: string, state: string): string {
  return `${NATIVE_X_AUTH_PATH}?${new URLSearchParams({ code, [NATIVE_STATE_PARAM]: state }).toString()}`;
}

export function nativeHandoffStep(i: NativeHandoffInput): NativeHandoffStep {
  if (!isHandoffState(i.state) || !isHandoffChallenge(i.challenge)) return { kind: "page" };
  const q = (params: Record<string, string>) => new URLSearchParams({ ...params, [NATIVE_STATE_PARAM]: i.state as string }).toString();
  if (!i.configured) return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ error: "config" })}` };
  if (i.session) return { kind: "consent", handle: i.session.handle, state: i.state, challenge: i.challenge };
  if (i.result === "err") return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ error: i.reason && REASONS.has(i.reason) ? i.reason : "server" })}` };
  // A finished sign-in with no session (a blocked cookie) must not loop: tell the app rather than start again.
  if (i.result === "1") return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ error: "state" })}` };
  const back = `/native-auth?${new URLSearchParams({ [NATIVE_STATE_PARAM]: i.state, [NATIVE_CHALLENGE_PARAM]: i.challenge }).toString()}`;
  return { kind: "begin", to: `/api/x/start?return=${encodeURIComponent(back)}` };
}
