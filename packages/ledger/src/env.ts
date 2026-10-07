import { z } from "zod";

/**
 * Ledger configuration from the environment. Two auth modes:
 * - `none`: the local `dpm sandbox` (no auth). Commands and completions then need an explicit
 *   `userId` (Canton rejects them with INVALID_TOKEN "missing a user-id" otherwise), taken from
 *   `LEDGER_USER_ID`.
 * - `password`: Noders DevNet. A Keycloak password grant per process; `userId` is omitted and the
 *   token's `sub` supplies it.
 *
 * Only names are logged, never values. `ledgerConfigSummary` is the one safe printer.
 */
const common = {
  LEDGER_JSON_API_URL: z.url({ protocol: /^https?$/ }),
  LEDGER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  LEDGER_SUBMIT_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LEDGER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
  /** How long a submit waits on a pending earlier submission (SUBMISSION_ALREADY_IN_FLIGHT) before "outcome unknown". */
  LEDGER_INFLIGHT_WAIT_MS: z.coerce.number().int().positive().default(180_000),
};

const noneSchema = z.object({
  LEDGER_AUTH_MODE: z.literal("none"),
  LEDGER_USER_ID: z.string().regex(/^[a-zA-Z0-9@^$.!`\-#+'~_|:]{1,128}$/).default("owarine-local"),
  ...common,
});

const passwordSchema = z.object({
  LEDGER_AUTH_MODE: z.literal("password"),
  LEDGER_OIDC_TOKEN_URL: z.url({ protocol: /^https$/ }),
  LEDGER_OIDC_CLIENT_ID: z.string().min(1),
  LEDGER_OIDC_USERNAME: z.string().min(1),
  LEDGER_OIDC_PASSWORD: z.string().min(1),
  /** No `offline_access`: this package never stores a refresh token (plan §9, option A). */
  LEDGER_OIDC_SCOPE: z.string().min(1).default("openid daml_ledger_api"),
  /** When set, the granted token's `aud` must contain it (catches a wrong realm or client early). */
  LEDGER_OIDC_AUDIENCE: z.url().optional(),
  ...common,
});

export const ledgerEnvSchema = z.discriminatedUnion("LEDGER_AUTH_MODE", [noneSchema, passwordSchema]);

export type LedgerEnv = z.infer<typeof ledgerEnvSchema>;

export class LedgerConfigError extends Error {
  override readonly name = "LedgerConfigError";
}

/** Parse the ledger env. `LEDGER_AUTH_MODE` defaults to `none`. Errors name variables, never values. */
export function parseLedgerEnv(env: Record<string, string | undefined> = process.env): LedgerEnv {
  const input = { ...env, LEDGER_AUTH_MODE: env.LEDGER_AUTH_MODE ?? "none" };
  const parsed = ledgerEnvSchema.safeParse(input);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new LedgerConfigError(`Invalid ledger environment:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** A loggable summary: URLs and modes only; never the username, password or any token. */
export function ledgerConfigSummary(env: LedgerEnv): Record<string, string> {
  const base = { mode: env.LEDGER_AUTH_MODE, url: env.LEDGER_JSON_API_URL };
  if (env.LEDGER_AUTH_MODE === "none") return { ...base, userId: env.LEDGER_USER_ID };
  return { ...base, tokenUrl: env.LEDGER_OIDC_TOKEN_URL, clientId: env.LEDGER_OIDC_CLIENT_ID, scope: env.LEDGER_OIDC_SCOPE };
}
