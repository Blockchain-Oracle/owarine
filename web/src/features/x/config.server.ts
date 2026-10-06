/**
 * What the X rail needs from the environment, and what is missing — server only.
 *
 * Every route answers `{ configured: false, missing: [...] }` rather than failing when a
 * variable is absent, so the pages keep their controls and say exactly what would connect them.
 *
 * Sign-in is OAuth 1.0a (2026-09-05), so the app's consumer key pair is what the web needs — the
 * same "API Key / API Key Secret" the developer portal shows first; no OAuth 2.0 client.
 */

import { seatServer } from "@/lib/ledger.server";
export interface XConfig {
  consumerKey: string;
  consumerSecret: string;
  redirectUri: string;
  sessionSecret: string;
  /** The executor wallet an EXECUTOR grant names; the relay signs from it. */
  executorAddress: string | null;
}

export type XConfigReading = { configured: true; config: XConfig } | { configured: false; missing: string[] };

export const X_ENV = {
  consumerKey: "X_API_KEY",
  consumerSecret: "X_API_KEY_SECRET",
  redirectUri: "X_REDIRECT_URI",
  sessionSecret: "X_SESSION_SECRET",
  /** C9e: the name the code actually reads (`X_EXECUTOR_PARTY`, else `NEXT_PUBLIC_X_EXECUTOR_PARTY`). */
  executor: "X_EXECUTOR_PARTY",
} as const;

export function readXConfig(origin: string): XConfigReading {
  const consumerKey = process.env.X_API_KEY ?? "";
  const consumerSecret = process.env.X_API_KEY_SECRET ?? "";
  const sessionSecret = process.env.X_SESSION_SECRET ?? "";
  const missing: string[] = [];
  if (!consumerKey) missing.push(X_ENV.consumerKey);
  if (!consumerSecret) missing.push(X_ENV.consumerSecret);
  if (!sessionSecret) missing.push(X_ENV.sessionSecret);
  if (missing.length > 0) return { configured: false, missing };
  return {
    configured: true,
    config: {
      consumerKey,
      consumerSecret,
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
