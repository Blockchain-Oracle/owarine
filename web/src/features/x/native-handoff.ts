/**
 * The X sign-in handoff into the app (plan: `/native-auth` "gets a job", C13a). The phone opens `/native-auth?state=`
 * in an auth session (ASWebAuthenticationSession); the web runs the ordinary X sign-in and then hands the signed X
 * session to the app on its own scheme, `<scheme>://x-auth?session=&state=`. The app checks `state` is the one it
 * made, keeps the session and sends it back in `X_SESSION_HEADER`. This file decides the next step; the page supplies
 * the app's scheme (never spelled here) and the session read from the cookie.
 */
export const NATIVE_X_AUTH_PATH = "x-auth";
export const NATIVE_STATE_PARAM = "state";

/** The app's nonce: 16 to 64 random bytes as lowercase hex. */
const STATE = /^[0-9a-f]{32,128}$/;
export const isHandoffState = (s: string | null | undefined): s is string => typeof s === "string" && STATE.test(s);

/** Why the X sign-in did not finish, as the callback names it (`x_reason`), kept to known words. */
const REASONS = new Set(["config", "denied", "state", "token", "server"]);

export type NativeHandoffStep =
  /** Not from the app (no nonce): the page explains, it never redirects into an app scheme. */
  | { kind: "page" }
  /** Not signed in yet: run the ordinary X sign-in, coming back here with the same nonce. */
  | { kind: "begin"; to: string }
  /** Done or failed: this path on the app's scheme (`x-auth?…`). */
  | { kind: "app"; path: string };

export interface NativeHandoffInput {
  state: string | null;
  /** The callback's `x` (1 or err) and `x_reason`. */
  result: string | null;
  reason: string | null;
  /** Whether X sign-in is configured on this host. */
  configured: boolean;
  /** The signed X session token this browser holds, if any. */
  session: string | null;
}

export function nativeHandoffStep(i: NativeHandoffInput): NativeHandoffStep {
  if (!isHandoffState(i.state)) return { kind: "page" };
  const q = (params: Record<string, string>) => new URLSearchParams({ ...params, [NATIVE_STATE_PARAM]: i.state as string }).toString();
  if (!i.configured) return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ error: "config" })}` };
  if (i.session) return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ session: i.session })}` };
  if (i.result === "err") return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ error: i.reason && REASONS.has(i.reason) ? i.reason : "server" })}` };
  // A finished sign-in with no session (a blocked cookie) must not loop: tell the app rather than start again.
  if (i.result === "1") return { kind: "app", path: `${NATIVE_X_AUTH_PATH}?${q({ error: "state" })}` };
  return { kind: "begin", to: `/api/x/start?return=${encodeURIComponent(`/native-auth?${NATIVE_STATE_PARAM}=${i.state}`)}` };
}
