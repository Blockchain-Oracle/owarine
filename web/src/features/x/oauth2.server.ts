import { createHash, randomBytes } from "node:crypto";
import type { XIdentity } from "./oauth.server";

/**
 * "Sign in with X" as OAuth 2.0 Authorization Code with PKCE — server only. Owarine's X app now holds an OAuth 2.0
 * client (8 Oct), so this path runs when `X_OAUTH2_CLIENT_ID` / `X_OAUTH2_CLIENT_SECRET` are set and the OAuth 1.0a
 * consumer pair is not. Unlike 1.0a, the token answer does not name the user, so one `GET /2/users/me` follows; a plan
 * that refuses it lands as the `profile` reason ("X connected, but your profile could not be read"), never a raw body.
 * The access token is used for that one read and dropped: the site never acts as the user.
 */
const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";
/** `users.read` needs `tweet.read` beside it; nothing broader is asked for. */
export const OAUTH2_SCOPES = "tweet.read users.read";
/** X's token and profile endpoints answer in well under a second; past this the sign-in is said as unreachable (C9e). */
const X_TIMEOUT_MS = 10_000;

export interface OAuth2Client {
  clientId: string;
  clientSecret: string;
}

/** A fresh PKCE pair (RFC 7636): a 43-character verifier and its S256 challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

/** The `state` that ties X's answer to the browser that started (CSRF), carried in an httpOnly cookie. */
export const oauth2State = (): string => randomBytes(24).toString("base64url");

export function authorizeUrl(client: Pick<OAuth2Client, "clientId">, redirectUri: string, state: string, challenge: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", OAUTH2_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type Failure = { error: string; status: number };

/** The code X sent back, exchanged for an access token (confidential client: Basic auth with the client pair). */
export async function exchangeCode(client: OAuth2Client, code: string, verifier: string, redirectUri: string): Promise<{ accessToken: string } | Failure> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier, client_id: client.clientId }),
      cache: "no-store",
      signal: AbortSignal.timeout(X_TIMEOUT_MS),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.name : "unreachable", status: 0 };
  }
  const body = (await response.json().catch(() => null)) as { access_token?: unknown; error?: unknown } | null;
  if (!response.ok || typeof body?.access_token !== "string") return { error: typeof body?.error === "string" ? body.error : `status ${response.status}`, status: response.status };
  return { accessToken: body.access_token };
}

/** Who signed in: the one profile read the token is used for. */
export async function readMe(accessToken: string): Promise<XIdentity | Failure> {
  let response: Response;
  try {
    response = await fetch(ME_URL, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(X_TIMEOUT_MS) });
  } catch (error) {
    return { error: error instanceof Error ? error.name : "unreachable", status: 0 };
  }
  const body = (await response.json().catch(() => null)) as { data?: { id?: unknown; username?: unknown } } | null;
  const id = body?.data?.id;
  if (!response.ok || typeof id !== "string" || !id) return { error: `status ${response.status}`, status: response.status };
  return { id, username: typeof body?.data?.username === "string" ? body.data.username : null };
}
