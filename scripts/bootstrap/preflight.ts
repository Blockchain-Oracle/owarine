/**
 * The DevNet preflight (C2y): what can be known about a participant from its public base URL, and, with the platform
 * credential in the environment, what our ledger user can do there. Each result is an acceptance row.
 *
 * Without credentials: `/v2/version` and CORS only. With them (the `LEDGER_OIDC_*` names of `packages/ledger/src/env.ts`):
 * the token grant and its lifetime, whether a second session on the same login leaves the first one valid (K-035: if
 * not, option B is forced), our own user and its rights, and the connected synchronizer. Nothing is enumerated: no
 * unfiltered `/v2/parties`, no `/v2/users`. Nothing is written. No token, username or password is ever printed.
 */
import {
  createLedgerClient, decodeJwtPayload, ledgerEnvSchema, passwordGrant, type ConnectedSynchronizer, type LedgerClient, type TokenSource,
} from "@owarine/ledger";
import type { PartiesFile } from "../../services/ops/src/runtime/keys";
import { authenticatedUser, userRights } from "./devnet-checks";
import { partySlots, shortParty } from "./devnet-parties";
import { errorEvidence, type CheckRow } from "./rows";

export interface PreflightOptions {
  baseUrl: string;
  /** The browser origin the CORS check claims (the web's public origin). */
  origin: string;
  env: Record<string, string | undefined>;
  /** Our parties (optional): the rights row then says how many of them the user can act as. */
  parties?: PartiesFile;
  fetch?: typeof fetch;
}

const REQUEST_TIMEOUT_MS = 20_000;

export async function runPreflight(o: PreflightOptions): Promise<CheckRow[]> {
  const doFetch = o.fetch ?? globalThis.fetch;
  const base = o.baseUrl.replace(/\/+$/, "");
  const rows: CheckRow[] = [];

  // 1. The version, as a browser would ask for it.
  let acaoOnGet: string | null = null;
  try {
    const res = await doFetch(`${base}/v2/version`, { headers: { Accept: "application/json", Origin: o.origin }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    acaoOnGet = res.headers.get("access-control-allow-origin");
    const body = (await res.json().catch(() => ({}))) as { version?: string };
    rows.push(res.ok && body.version
      ? { check: "GET /v2/version (no token)", outcome: "pass", detail: `Canton ${body.version}`, evidence: "GET /v2/version" }
      : { check: "GET /v2/version (no token)", outcome: "fail", detail: `HTTP ${res.status}`, evidence: "GET /v2/version" });
  } catch (e) {
    rows.push({ check: "GET /v2/version (no token)", outcome: "fail", detail: e instanceof Error ? e.message : String(e), evidence: base });
  }

  // 2. CORS: the preflight a browser sends before an authenticated POST. The product calls the ledger from its servers,
  //    so a closed CORS policy is a note, not a failure.
  try {
    const res = await doFetch(`${base}/v2/commands/submit-and-wait-for-transaction`, {
      method: "OPTIONS",
      headers: { Origin: o.origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const acao = res.headers.get("access-control-allow-origin");
    const acah = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    const originOk = acao === "*" || acao === o.origin;
    // A `*` in Allow-Headers does not cover Authorization (Fetch spec): it must be named.
    const authOk = acah.split(",").map((h) => h.trim()).includes("authorization");
    const detail = `preflight HTTP ${res.status}; allow-origin ${acao ?? "absent"}; allow-headers ${acah || "absent"}; GET allow-origin ${acaoOnGet ?? "absent"}`;
    rows.push({ check: "CORS for a browser origin", outcome: res.ok && originOk && authOk ? "pass" : "warn", detail: res.ok && originOk && authOk ? `open to ${o.origin} with Authorization (${detail})` : `not open to authenticated browser calls; server-side calls are unaffected (${detail})`, evidence: "OPTIONS /v2/commands/submit-and-wait-for-transaction" });
  } catch (e) {
    rows.push({ check: "CORS for a browser origin", outcome: "warn", detail: `preflight failed: ${e instanceof Error ? e.message : String(e)}`, evidence: "OPTIONS" });
  }

  // 3. Everything that needs the platform credential.
  const parsed = ledgerEnvSchema.safeParse({ ...o.env, LEDGER_AUTH_MODE: "password", LEDGER_JSON_API_URL: base });
  if (!parsed.success || parsed.data.LEDGER_AUTH_MODE !== "password") {
    const names = parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    const skip = `no credentials in the environment (${names.join(", ") || "LEDGER_OIDC_*"})`;
    for (const check of ["token grant", "concurrent sessions", "ledger user", "ledger user rights", "connected synchronizer"]) rows.push({ check, outcome: "skip", detail: skip });
    return rows;
  }
  const cfg = parsed.data;
  const grantCfg = {
    tokenUrl: cfg.LEDGER_OIDC_TOKEN_URL, clientId: cfg.LEDGER_OIDC_CLIENT_ID, username: cfg.LEDGER_OIDC_USERNAME, password: cfg.LEDGER_OIDC_PASSWORD,
    scope: cfg.LEDGER_OIDC_SCOPE, ...(cfg.LEDGER_OIDC_AUDIENCE === undefined ? {} : { audience: cfg.LEDGER_OIDC_AUDIENCE }),
  };
  const first = passwordGrant(grantCfg, { fetch: doFetch });
  const clientOf = (auth: TokenSource): LedgerClient => createLedgerClient({ baseUrl: base, auth, timeoutMs: REQUEST_TIMEOUT_MS, maxAttempts: 2 }, { fetch: doFetch });
  const client = clientOf(first);

  let token1: string;
  try {
    const t0 = Date.now();
    token1 = (await first.token())!;
    const claims = decodeJwtPayload(token1) ?? {};
    const ttl = typeof claims.exp === "number" && typeof claims.iat === "number" ? claims.exp - claims.iat : Math.round(((first.refreshAt() ?? t0) - t0) / 800);
    const aud = Array.isArray(claims.aud) ? claims.aud.join(" ") : typeof claims.aud === "string" ? claims.aud : "none";
    rows.push({ check: "token grant", outcome: "pass", detail: `password grant at ${new URL(cfg.LEDGER_OIDC_TOKEN_URL).host}; lifetime ${ttl} s (${(ttl / 3600).toFixed(2)} h); re-grant at 80%; aud ${aud}; refresh token discarded`, evidence: "POST <realm>/protocol/openid-connect/token" });
  } catch (e) {
    rows.push({ check: "token grant", outcome: "fail", ...errorEvidence(e) });
    for (const check of ["concurrent sessions", "ledger user", "ledger user rights", "connected synchronizer"]) rows.push({ check, outcome: "skip", detail: "no token" });
    return rows;
  }

  // Two processes (web and ops) each hold their own grant on one login (K-035 option A). A realm that caps sessions
  // revokes the older token when the newer is issued: the first client then gets 401.
  try {
    const second = passwordGrant(grantCfg, { fetch: doFetch });
    await second.token();
    await authenticatedUser(clientOf(second));
    const pinned: TokenSource = { mode: "password", token: async () => token1, invalidate: () => {}, refreshAt: () => undefined, onRegrant: () => () => {} };
    await authenticatedUser(clientOf(pinned));
    rows.push({ check: "concurrent sessions", outcome: "pass", detail: "a second grant on the same login leaves the first token valid: K-035 option A holds", evidence: "GET /v2/authenticated-user with each token" });
  } catch (e) {
    const ev = errorEvidence(e);
    rows.push({ check: "concurrent sessions", outcome: "fail", detail: `${ev.detail}: the realm does not keep two sessions; K-035 option B (ops serves tokens) is forced`, evidence: ev.evidence });
  }

  let userId: string | undefined;
  try {
    const me = await authenticatedUser(client);
    userId = me.id;
    rows.push({ check: "ledger user", outcome: "pass", detail: `user ${me.id}; primary party ${me.primaryParty ? shortParty(me.primaryParty) : "none"}`, evidence: "GET /v2/authenticated-user" });
  } catch (e) {
    rows.push({ check: "ledger user", outcome: "fail", ...errorEvidence(e) });
  }

  if (userId === undefined) {
    rows.push({ check: "ledger user rights", outcome: "skip", detail: "no user id" });
  } else {
    try {
      const r = await userRights(client, userId);
      let detail = `act-as over ${r.actAs.size} parties, read-as over ${r.readAs.size}; participant admin ${r.participantAdmin ? "yes" : "no"}${r.other.length ? `; also ${[...new Set(r.other)].join(", ")}` : ""}`;
      let outcome: CheckRow["outcome"] = r.actAs.size > 0 ? "pass" : "fail";
      if (o.parties) {
        const slots = partySlots(o.parties);
        const missing = slots.filter((s) => !r.actAs.has(s.party)).map((s) => s.slot);
        detail += `; act-as over ${slots.length - missing.length} of our ${slots.length} parties${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`;
        if (missing.length) outcome = "fail";
      }
      rows.push({ check: "ledger user rights", outcome, detail, evidence: "GET /v2/users/{own id}/rights" });
    } catch (e) {
      rows.push({ check: "ledger user rights", outcome: "fail", ...errorEvidence(e) });
    }
  }

  try {
    // Some 3.x nodes want the `party` the question is about; ask without it first, then as our venue.
    const venue = o.parties?.parties.venue;
    const list = await client.connectedSynchronizers().catch(async (e: unknown) => {
      if (!venue) throw e;
      const r = await client.http.request<{ connectedSynchronizers?: ConnectedSynchronizer[] }>("GET", "/v2/state/connected-synchronizers", { query: { party: venue } });
      return r.connectedSynchronizers ?? [];
    });
    rows.push(list.length > 0
      ? { check: "connected synchronizer", outcome: "pass", detail: list.map((s) => `${s.synchronizerAlias}: ${s.synchronizerId}${s.permission ? ` (${s.permission})` : ""}`).join("; "), evidence: "GET /v2/state/connected-synchronizers" }
      : { check: "connected synchronizer", outcome: "fail", detail: "the participant reports no connected synchronizer", evidence: "GET /v2/state/connected-synchronizers" });
  } catch (e) {
    rows.push({ check: "connected synchronizer", outcome: "fail", ...errorEvidence(e) });
  }
  return rows;
}
