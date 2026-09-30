/**
 * DevNet preflight (C2y): given only the participant's public JSON API base URL, checks `/v2/version` and CORS; with the
 * platform credential in the environment (the `LEDGER_OIDC_*` names, never on the command line), also the token grant
 * and its lifetime, two concurrent sessions on one login (K-035), our user and its rights, and the connected
 * synchronizer. Prints a table, then each result as a `docs/plan/acceptance.md` row. Read-only: nothing is written,
 * nothing is enumerated, no secret is printed.
 *
 *   pnpm --filter @agari/scripts exec tsx devnet-preflight.ts <json-api-base-url> [--origin https://<web origin>] [--parties file]
 *
 * Exit code 1 when any check fails (a CORS note or a skipped check is not a failure).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { arg } from "./drive/cli";
import { parseDevnetParties } from "./bootstrap/devnet-parties";
import { runPreflight } from "./bootstrap/preflight";
import { acceptanceRow, failed, table } from "./bootstrap/rows";

const baseUrl = process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) ?? process.env.LEDGER_JSON_API_URL;
if (!baseUrl) {
  console.error("usage: devnet-preflight.ts <json-api-base-url> [--origin https://…] [--parties file]");
  process.exit(2);
}
const origin = arg("--origin", process.env.NEXT_PUBLIC_APP_ORIGIN || "https://example.invalid");
const partiesPath = arg("--parties", "");
const parties = partiesPath && existsSync(resolve(partiesPath)) ? parseDevnetParties(readFileSync(resolve(partiesPath), "utf8")).file : undefined;
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: import.meta.dirname, encoding: "utf8" }).trim();
  } catch {
    return "—";
  }
})();

const atIso = new Date().toISOString();
const rows = await runPreflight({ baseUrl, origin, env: process.env, ...(parties ? { parties } : {}) });
console.log(`DevNet preflight of ${baseUrl} at ${atIso}\n`);
console.log(table(rows));
console.log("\n--- acceptance rows (docs/plan/acceptance.md) ---");
for (const r of rows) console.log(acceptanceRow(r, { stage: "C2y", commit, atIso, prefix: "Noders preflight: " }));
process.exitCode = failed(rows) ? 1 : 0;
