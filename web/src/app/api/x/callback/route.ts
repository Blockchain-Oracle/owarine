import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { readXConfig } from "@/features/x/config.server";
import { publicOrigin } from "@/lib/client-ip.server";
import { accessToken, type XIdentity } from "@/features/x/oauth.server";
import { exchangeCode, readMe } from "@/features/x/oauth2.server";
import { X_DEFAULT_RETURN, X_REASON_PARAM, X_RETURN_PARAM } from "@/features/x/protocol";
import { signSession, X_OAUTH_COOKIES, X_SESSION_COOKIE, X_SESSION_TTL_MS } from "@/features/x/session.server";

export const dynamic = "force-dynamic";

/**
 * X redirects here. OAuth 1.0a: `?oauth_token&oauth_verifier`; the token must be the one this browser started with,
 * and the verifier is exchanged for the account's id and handle. OAuth 2.0: `?code&state` (or `?error`); the state must
 * match this browser's cookie, the code is exchanged with the PKCE verifier, and one `/2/users/me` names the account.
 * Either way the id and handle go into a signed session and the browser bounces back to the page that started it with
 * `?x=1` — or `?x=err&x_reason=`. Ported from the reference's `api/claim/x/callback`.
 *
 * The way home is built on the callback's own public origin (`X_REDIRECT_URI`), never the server's view of the
 * request: behind Cloudflare that is `http://`, which would bounce a signed-in browser off TLS.
 */
export async function GET(req: NextRequest) {
  const reading = readXConfig(publicOrigin(req));
  const origin = reading.configured ? new URL(reading.config.redirectUri).origin : publicOrigin(req);
  const jar = await cookies();
  const ret = jar.get(X_OAUTH_COOKIES.ret)?.value;
  const home = `${origin}${ret && ret.startsWith("/") && !ret.startsWith("//") ? ret : X_DEFAULT_RETURN}`;
  const withResult = (result: "1" | "err", reason?: string) => {
    const url = new URL(home);
    url.searchParams.set(X_RETURN_PARAM, result);
    if (reason) url.searchParams.set(X_REASON_PARAM, reason);
    return url.toString();
  };

  if (!reading.configured) return NextResponse.redirect(withResult("err", "config"));
  const { config } = reading;

  const params = req.nextUrl.searchParams;
  let identity: XIdentity;
  try {
    if (config.credentials.kind === "oauth2") {
      if (params.get("error")) return NextResponse.redirect(withResult("err", "denied"));
      const code = params.get("code");
      const state = params.get("state");
      const savedState = jar.get(X_OAUTH_COOKIES.state)?.value;
      const verifier = jar.get(X_OAUTH_COOKIES.verifier)?.value;
      if (!code) return NextResponse.redirect(withResult("err", "denied"));
      if (!state || !savedState || !verifier || state !== savedState) return NextResponse.redirect(withResult("err", "state"));
      const token = await exchangeCode(config.credentials, code, verifier, config.redirectUri);
      if ("error" in token) {
        console.error("X OAuth 2.0 token exchange failed", { status: token.status, error: token.error });
        // X's own error code ("invalid_grant") rides along so the page can say it; anything else is a plain failure.
        return NextResponse.redirect(withResult("err", !token.status ? "server" : /^[a-z_]+$/.test(token.error) ? `token_${token.error}` : "token"));
      }
      const me = await readMe(token.accessToken);
      if ("error" in me) {
        console.error("X profile read failed", { status: me.status, error: me.error });
        return NextResponse.redirect(withResult("err", "profile"));
      }
      identity = me;
    } else {
      const oauthToken = params.get("oauth_token");
      const verifier = params.get("oauth_verifier");
      const savedToken = jar.get(X_OAUTH_COOKIES.token)?.value;
      const savedSecret = jar.get(X_OAUTH_COOKIES.secret)?.value;
      if (!oauthToken || !verifier) return NextResponse.redirect(withResult("err", "denied"));
      if (!savedToken || !savedSecret || oauthToken !== savedToken) return NextResponse.redirect(withResult("err", "state"));
      const answer = await accessToken(config.credentials, { oauthToken: savedToken, oauthTokenSecret: savedSecret }, verifier);
      if ("error" in answer) {
        console.error("X access token failed", { status: answer.status, error: answer.error });
        return NextResponse.redirect(withResult("err", "token"));
      }
      identity = answer;
    }
  } catch (error) {
    console.error("X OAuth callback failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(withResult("err", "server"));
  }

  const res = NextResponse.redirect(withResult("1"));
  res.cookies.set(X_SESSION_COOKIE, signSession(config.sessionSecret, { authorId: identity.id, handle: identity.username, t: Date.now() }), {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(X_SESSION_TTL_MS / 1000),
  });
  for (const name of Object.values(X_OAUTH_COOKIES)) res.cookies.delete(name);
  return res;
}
