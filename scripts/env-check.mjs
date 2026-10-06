#!/usr/bin/env node
// Prints which environment variables are present for root scripts, web and ops. Never prints values.
// Run: pnpm env:check
// Reads .env.local files (root, web, services/ops) plus the process environment. Always exits 0.
//
// The lists are the names the code reads today, grouped as the hosted deploy groups them
// (docs/plan/runbooks/coolify-deploy.md §4; C4e replaced the Solana-era keys on 6 Oct):
//   boot     production refuses to start without it (web: src/instrumentation-node.ts; ops: the ledger and the parties)
//   build    a NEXT_PUBLIC_* value Next inlines at build time ("Build Variable" on Coolify, build time only)
//   hosted   needed behind Coolify's Traefik, not on a laptop
//   feature  one named feature answers "not live" without it
//   optional has a default

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const FILES = { root: ".env.local", web: "web/.env.local", ops: "services/ops/.env.local" };

/** [name, need] */
const GROUPS = {
  root: [
    ["LEDGER_JSON_API_URL", "optional"], ["LEDGER_AUTH_MODE", "optional"], ["AGARI_PARTIES_FILE", "optional"], ["DATABASE_URL", "optional"],
    ["ALPACA_ENDPOINT", "feature"], ["ALPACA_KEY_ID", "feature"], ["ALPACA_SECRET_KEY", "feature"], ["FINNHUB_API_KEY", "feature"],
    ["PYTH_API_KEY", "optional"], ["JUPITER_API_KEY", "optional"], ["OPS_INTERNAL_URL", "optional"], ["OPS_ADMIN_SECRET", "optional"],
  ],
  web: [
    ["DATABASE_URL", "boot"], ["AGARI_SEAT_COOKIE_SECRET", "boot"], ["OPS_INTERNAL_URL", "boot"], ["OPS_INTERNAL_SECRET", "boot"],
    ["AGARI_PARTIES_FILE", "boot"], ["LEDGER_JSON_API_URL", "boot"], ["LEDGER_AUTH_MODE", "boot"],
    ["TRUSTED_PROXY", "hosted"],
    ["NEXT_PUBLIC_APP_ORIGIN", "build"], ["NEXT_PUBLIC_SITE_URL", "build"], ["NEXT_PUBLIC_DOCS_URL", "build"],
    ["NEXT_PUBLIC_PRICE_FEED_URL", "build"], ["NEXT_PUBLIC_LADDER_URL", "build"], ["NEXT_PUBLIC_CANTON_NETWORK", "optional"],
    ["NEXT_PUBLIC_AGARI_VENUE_ID", "optional"], ["NEXT_PUBLIC_SHARED_DESK_ID", "optional"],
    ["ROOM_TOKEN_SECRET", "feature"], ["GAME_ROOM_PUBLIC_URL", "feature"], ["PUSH_DRAIN_SECRET", "feature"], ["EXPO_ACCESS_TOKEN", "feature"],
    ["FINNHUB_API_KEY", "feature"], ["AI_MODEL", "feature"], ["X_API_KEY", "feature"], ["X_API_KEY_SECRET", "feature"],
    ["X_REDIRECT_URI", "feature"], ["X_SESSION_SECRET", "feature"], ["IOS_APP_ID", "feature"],
  ],
  ops: [
    ["DATABASE_URL", "boot"], ["DRY_RUN", "boot"], ["OPS_INTERNAL_SECRET", "boot"], ["AGARI_PARTIES_FILE", "boot"],
    ["LEDGER_JSON_API_URL", "boot"], ["LEDGER_AUTH_MODE", "boot"],
    ["AGARI_WEB_ORIGIN", "hosted"], ["NEXT_PUBLIC_APP_ORIGIN", "hosted"],
    ["ALPACA_ENDPOINT", "feature"], ["ALPACA_KEY_ID", "feature"], ["ALPACA_SECRET_KEY", "feature"], ["FINNHUB_API_KEY", "feature"],
    ["PYTH_API_KEY", "optional"], ["JUPITER_API_KEY", "optional"], ["REDSTONE_GATEWAY_URLS", "optional"],
    ["OPS_ADMIN_SECRET", "feature"], ["ROOM_TOKEN_SECRET", "feature"], ["GAME_DECK_KEY", "feature"], ["PUSH_DRAIN_URL", "feature"],
    ["PUSH_DRAIN_SECRET", "feature"], ["OPENAI_API_KEY", "feature"], ["AI_MODEL", "feature"], ["X_HANDLE", "feature"], ["X_RETTIWT_API_KEY", "feature"],
  ],
};

const load = (path) => (existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : null);

// C2y: with LEDGER_AUTH_MODE=password (Noders DevNet) the web and ops each need the platform credential's names.
const OIDC = [["LEDGER_OIDC_TOKEN_URL", "boot"], ["LEDGER_OIDC_CLIENT_ID", "boot"], ["LEDGER_OIDC_USERNAME", "boot"], ["LEDGER_OIDC_PASSWORD", "boot"], ["LEDGER_OIDC_SCOPE", "optional"], ["LEDGER_OIDC_AUDIENCE", "optional"]];
for (const group of ["web", "ops"]) {
  const mode = (load(FILES[group])?.LEDGER_AUTH_MODE ?? process.env.LEDGER_AUTH_MODE ?? "").trim();
  if (mode === "password") GROUPS[group].push(...OIDC);
}

const missingBoot = [];
for (const [group, vars] of Object.entries(GROUPS)) {
  const file = load(FILES[group]);
  console.log(`\n${group} (${FILES[group]}${file ? "" : " — file missing"})`);
  const rows = vars.map(([name, need]) => {
    const present = Boolean((file?.[name] ?? process.env[name] ?? "").trim());
    if (!present && need === "boot") missingBoot.push(`${group}:${name}`);
    return { name, need, status: present ? "✅ set" : need === "optional" ? "· optional" : "☐ missing" };
  });
  console.table(rows);
}
console.log(missingBoot.length ? `\n${missingBoot.length} name(s) a production boot needs are missing: ${missingBoot.join(", ")}.` : "\nEvery name a production boot needs is set.");
