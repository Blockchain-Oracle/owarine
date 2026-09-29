import type { LedgerEnv } from "./env";
import { LedgerError } from "./errors";

/**
 * Where ledger calls get their bearer token.
 *
 * `password` (Noders): one Keycloak password grant per process, single-flight, re-granted once 80% of
 * `expires_in` has passed, never on a 401 storm (a 401 invalidates only the token that failed, so N
 * concurrent 401s cause one grant). The refresh token Keycloak returns is dropped on the floor:
 * nothing here stores or uses it (plan §9, option A).
 */
export interface TokenSource {
  readonly mode: "none" | "password";
  /** The current bearer token; `undefined` when the ledger has no auth. */
  token(): Promise<string | undefined>;
  /** Drop `stale` if it is still the current token (or the current token if omitted). */
  invalidate(stale?: string): void;
  /** Epoch ms at which the current token is due for replacement; `undefined` if none is held. */
  refreshAt(): number | undefined;
  /** Called after every successful grant with the new token. Returns an unsubscribe function. */
  onRegrant(listener: (token: string) => void): () => void;
}

export function noAuth(): TokenSource {
  return {
    mode: "none",
    token: async () => undefined,
    invalidate: () => {},
    refreshAt: () => undefined,
    onRegrant: () => () => {},
  };
}

export interface PasswordGrantConfig {
  tokenUrl: string;
  clientId: string;
  username: string;
  password: string;
  scope: string;
  audience?: string;
  /** Fraction of `expires_in` after which the token is re-granted. Default 0.8. */
  refreshFraction?: number;
  /** After a failed re-grant while the old token is still valid, wait this long before trying again. */
  retryGapMs?: number;
}

export interface AuthDeps {
  fetch?: typeof fetch;
  now?: () => number;
}

interface Held {
  token: string;
  expiresAt: number;
  refreshAt: number;
}

const PATH = "oidc:token";

export function passwordGrant(cfg: PasswordGrantConfig, deps: AuthDeps = {}): TokenSource {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;
  const fraction = cfg.refreshFraction ?? 0.8;
  const retryGapMs = cfg.retryGapMs ?? 5_000;
  const listeners = new Set<(t: string) => void>();
  let held: Held | null = null;
  let inflight: Promise<string> | null = null;
  let nextAttemptAt = 0;

  const redact = (s: string) => redactSecrets(s, [cfg.password, cfg.username]);

  async function grant(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: cfg.clientId,
      username: cfg.username,
      password: cfg.password,
      scope: cfg.scope,
    });
    let res: Response;
    try {
      res = await doFetch(cfg.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body,
      });
    } catch (e) {
      throw new LedgerError({ kind: "network", path: PATH, message: redact(`token grant failed: ${errText(e)}`) });
    }
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 200);
      try {
        const j = JSON.parse(text) as { error?: string; error_description?: string };
        if (j.error) detail = j.error_description ? `${j.error} (${j.error_description})` : j.error;
      } catch {
        /* not JSON */
      }
      const kind = res.status >= 500 || res.status === 429 ? "unavailable" : "auth";
      throw new LedgerError({ kind, status: res.status, path: PATH, message: redact(`token grant failed: ${res.status} ${detail}`) });
    }
    let json: { access_token?: unknown; expires_in?: unknown };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new LedgerError({ kind: "auth", status: res.status, path: PATH, message: "token grant returned non-JSON" });
    }
    const token = json.access_token;
    const ttlS = Number(json.expires_in);
    if (typeof token !== "string" || token.length === 0 || !Number.isFinite(ttlS) || ttlS <= 0) {
      throw new LedgerError({ kind: "auth", status: res.status, path: PATH, message: "token grant response lacks access_token/expires_in" });
    }
    if (cfg.audience !== undefined) checkAudience(token, cfg.audience);
    const t0 = now();
    held = { token, expiresAt: t0 + ttlS * 1000, refreshAt: t0 + Math.floor(ttlS * 1000 * fraction) };
    for (const l of listeners) {
      try {
        l(token);
      } catch {
        /* a listener must not break the grant */
      }
    }
    return token;
  }

  return {
    mode: "password",
    async token() {
      const t = now();
      if (held && t < held.refreshAt) return held.token;
      // Due for re-grant. While the old token is still valid, a failed grant falls back to it and
      // waits `retryGapMs` before the next attempt, so a Keycloak outage is not hammered.
      if (held && t < held.expiresAt && t < nextAttemptAt) return held.token;
      inflight ??= grant().finally(() => {
        inflight = null;
      });
      try {
        return await inflight;
      } catch (e) {
        if (held && now() < held.expiresAt) {
          nextAttemptAt = now() + retryGapMs;
          return held.token;
        }
        throw e;
      }
    },
    invalidate(stale) {
      if (held && (stale === undefined || stale === held.token)) {
        held = null;
        nextAttemptAt = 0;
      }
    },
    refreshAt: () => held?.refreshAt,
    onRegrant(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function tokenSourceFromEnv(env: LedgerEnv, deps: AuthDeps = {}): TokenSource {
  if (env.LEDGER_AUTH_MODE === "none") return noAuth();
  return passwordGrant(
    {
      tokenUrl: env.LEDGER_OIDC_TOKEN_URL,
      clientId: env.LEDGER_OIDC_CLIENT_ID,
      username: env.LEDGER_OIDC_USERNAME,
      password: env.LEDGER_OIDC_PASSWORD,
      scope: env.LEDGER_OIDC_SCOPE,
      ...(env.LEDGER_OIDC_AUDIENCE === undefined ? {} : { audience: env.LEDGER_OIDC_AUDIENCE }),
    },
    deps,
  );
}

/** Decode a JWT's payload without verifying it (the participant verifies; we only sanity-check). */
export function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function checkAudience(token: string, audience: string): void {
  const aud = decodeJwtPayload(token)?.aud;
  const list = Array.isArray(aud) ? aud : typeof aud === "string" ? [aud] : [];
  if (!list.includes(audience)) {
    throw new LedgerError({
      kind: "auth",
      path: PATH,
      message: `granted token's aud ${JSON.stringify(list)} does not include the configured LEDGER_OIDC_AUDIENCE`,
    });
  }
}

export function redactSecrets(s: string, secrets: readonly string[]): string {
  let out = s;
  for (const secret of secrets) {
    if (secret.length < 3) continue;
    out = out.split(secret).join("[redacted]");
    const enc = encodeURIComponent(secret);
    if (enc !== secret) out = out.split(enc).join("[redacted]");
  }
  return out;
}

function errText(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: unknown }).cause;
    return cause instanceof Error ? `${e.message}: ${cause.message}` : e.message;
  }
  return String(e);
}
