/**
 * What the X rail needs from the environment, and what is missing — server only.
 *
 * Every route answers `{ configured: false, missing: [...] }` rather than failing when a
 * variable is absent, so the pages keep their controls and say exactly what would connect them.
 *
 * Sign-in runs on whichever pair the app has (8 Oct): the OAuth 1.0a consumer pair ("API Key / API Key Secret",
 * 2026-09-05) when it is set — its last step names the user, so no profile read — else the OAuth 2.0 client
 * (`X_OAUTH2_CLIENT_ID` / `X_OAUTH2_CLIENT_SECRET`, PKCE, oauth2.server.ts). Neither set: the missing list names the
 * OAuth 2.0 pair, the one Owarine's app holds.
 */

import { seatServer } from "@/lib/ledger.server";
export type XCredentials = { kind: "oauth1"; consumerKey: string; consumerSecret: string } | { kind: "oauth2"; clientId: string; clientSecret: string };

export interface XConfig {
  credentials: XCredentials;
  redirectUri: string;
  sessionSecret: string;
  /** The executor wallet an EXECUTOR grant names; the relay signs from it. */
  executorAddress: string | null;
}

export type XConfigReading = { configured: true; config: XConfig } | { configured: false; missing: string[] };

export const X_ENV = {
  consumerKey: "X_API_KEY",
  consumerSecret: "X_API_KEY_SECRET",
  clientId: "X_OAUTH2_CLIENT_ID",
  clientSecret: "X_OAUTH2_CLIENT_SECRET",
  redirectUri: "X_REDIRECT_URI",
  sessionSecret: "X_SESSION_SECRET",
  /** C9e: the name the code actually reads (`X_EXECUTOR_PARTY`, else `NEXT_PUBLIC_X_EXECUTOR_PARTY`). */
  executor: "X_EXECUTOR_PARTY",
} as const;

export function readXConfig(origin: string): XConfigReading {
  const consumerKey = process.env.X_API_KEY ?? "";
  const consumerSecret = process.env.X_API_KEY_SECRET ?? "";
  const clientId = process.env.X_OAUTH2_CLIENT_ID ?? "";
  const clientSecret = process.env.X_OAUTH2_CLIENT_SECRET ?? "";
  const sessionSecret = process.env.X_SESSION_SECRET ?? "";
  const credentials: XCredentials | null =
    consumerKey && consumerSecret ? { kind: "oauth1", consumerKey, consumerSecret } : clientId && clientSecret ? { kind: "oauth2", clientId, clientSecret } : null;
  const missing: string[] = [];
  if (!credentials) {
    if (!clientId) missing.push(X_ENV.clientId);
    if (!clientSecret) missing.push(X_ENV.clientSecret);
  }
  if (!sessionSecret) missing.push(X_ENV.sessionSecret);
  if (!credentials || missing.length > 0) return { configured: false, missing };
  return {
    configured: true,
    config: {
      credentials,
      redirectUri: process.env.X_REDIRECT_URI || `${origin}/api/x/callback`,
      sessionSecret,
      executorAddress: executorAddress(),
    },
  };
}

/**
 * The executor an EXECUTOR grant names (C8f): a party on Canton, public information (it is what the grant names). The
 * parties file's `agent-runner` (K-087), or `X_EXECUTOR_PARTY` / `NEXT_PUBLIC_X_EXECUTOR_PARTY` to override it.
 */
export function executorAddress(): string | null {
  const value = process.env.X_EXECUTOR_PARTY || process.env.NEXT_PUBLIC_X_EXECUTOR_PARTY || "";
  if (PARTY_ID.test(value)) return value;
  const state = seatServer();
  return state.ok ? state.server.parties.agentRunner : null;
}

const PARTY_ID = /^[A-Za-z0-9_\-:.]{1,255}::[0-9a-f]{8,}$/;
