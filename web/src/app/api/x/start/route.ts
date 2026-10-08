import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/client-ip.server";
import { regionRestricted, regionRestrictedResponse } from "@/lib/region.server";
import { readXConfig } from "@/features/x/config.server";
import { authenticateUrl, requestToken } from "@/features/x/oauth.server";
import { authorizeUrl, oauth2State, pkcePair } from "@/features/x/oauth2.server";
import { X_DEFAULT_RETURN, X_REASON_PARAM, X_RETURN_PARAM } from "@/features/x/protocol";
import { X_OAUTH_COOKIES, X_OAUTH_TTL_SEC } from "@/features/x/session.server";

export const dynamic = "force-dynamic";

/**
 * "Sign in with X", on whichever pair the app holds (config.server.ts). OAuth 1.0a: a request token bound to our
 * callback goes into short-lived httpOnly cookies, then a redirect to X's authenticate page. OAuth 2.0: a `state` and a
 * PKCE verifier go into those cookies instead, then a redirect to X's authorize page. `?return=/path` says where the callback lands
 * (default `/trade-from-x`). The reference's origin guard is kept: the cookies must be written on the
 * origin that receives the callback, or X appears to succeed and the page asks again.
 *
 * The guard compares hosts, not origins: behind Cloudflare the server speaks http while the callback is
 * https, and an origin compare redirected `/api/x/start` to itself forever (ERR_TOO_MANY_REDIRECTS,
 * 2026-09-24). Cookies are scoped by host, so the host is what the guard protects.
 */
export async function GET(req: NextRequest) {
  // The geofence comes before any key, balance or co-signature (D-095).
  if (regionRestricted(req)) return regionRestrictedResponse();
  const origin = publicOrigin(req);
  const reading = readXConfig(origin);
  if (!reading.configured) return NextResponse.json({ configured: false, missing: reading.missing });
  const { config } = reading;

  const ret = req.nextUrl.searchParams.get("return");
  const safeRet = ret && ret.startsWith("/") && !ret.startsWith("//") ? ret : "";

  const callback = new URL(config.redirectUri);
  if (new URL(origin).host !== callback.host) {
    const canonical = new URL("/api/x/start", callback.origin);
    if (safeRet) canonical.searchParams.set("return", safeRet);
    return NextResponse.redirect(canonical);
  }

  const opts = { httpOnly: true, secure: callback.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: X_OAUTH_TTL_SEC };
  const { credentials } = config;
  if (credentials.kind === "oauth2") {
    const state = oauth2State();
    const { verifier, challenge } = pkcePair();
    const res = NextResponse.redirect(authorizeUrl(credentials, config.redirectUri, state, challenge));
    res.cookies.set(X_OAUTH_COOKIES.state, state, opts);
    res.cookies.set(X_OAUTH_COOKIES.verifier, verifier, opts);
    if (safeRet) res.cookies.set(X_OAUTH_COOKIES.ret, safeRet, opts);
    return res;
  }

  const token = await requestToken(credentials, config.redirectUri);
  if ("error" in token) {
    console.error("X request token failed", { status: token.status, error: token.error });
    // C9e: this route is reached by a plain link, so a failure goes home with the reason the page already words
    // ("X connection is temporarily unavailable. Please try again."), never to a raw error body.
    const home = new URL(safeRet || X_DEFAULT_RETURN, callback.origin);
    home.searchParams.set(X_RETURN_PARAM, "err");
    home.searchParams.set(X_REASON_PARAM, "server");
    return NextResponse.redirect(home);
  }

  const res = NextResponse.redirect(authenticateUrl(token.oauthToken));
  res.cookies.set(X_OAUTH_COOKIES.token, token.oauthToken, opts);
  res.cookies.set(X_OAUTH_COOKIES.secret, token.oauthTokenSecret, opts);
  if (safeRet) res.cookies.set(X_OAUTH_COOKIES.ret, safeRet, opts);
  return res;
}
