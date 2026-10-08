/**
 * Bootstraps the venue on Noders DevNet (C2y, release R1): the same contracts as `bootstrap-local.ts`, made by the same
 * code (`bootstrap/venue.ts`), on parties and DARs Abu created and uploaded in the Console. It allocates nothing and
 * uploads nothing.
 *
 *   1. authenticates as the platform user (password grant per process, single-flight, re-granted at 80% of
 *      `expires_in`, no refresh token stored: `@owarine/ledger`, K-035 option A),
 *   2. reads the parties Abu filled (`--parties`, JSON in the shape of `scripts/bootstrap/devnet-parties.example.json`,
 *      or the Console's party list pasted as text) and checks each one by id: hosted here, and our user can act as it.
 *      Nothing on the shared node is enumerated (no unfiltered `/v2/parties`, no `/v2/users`),
 *   3. checks that the main package of each DAR in `daml/released/` (else `.daml/dist/`) is on the participant,
 *   4. creates the VenueDesk, the shards, the Series of every lane, the ticket reserves with their LP seed, the arena and
 *      the season pool, whatever is missing (idempotent: a re-run fills gaps only). `--dry-run` prepares each
 *      independent write against live state (interactive submission, step 1) and executes nothing,
 *   5. writes the normalised parties file ops and the web read (`--out`; never inside the repo: ids stay out of Git),
 *   6. prints every check and every write as a `docs/plan/acceptance.md` row.
 *
 *   LEDGER_AUTH_MODE=password LEDGER_JSON_API_URL=… LEDGER_OIDC_TOKEN_URL=… LEDGER_OIDC_CLIENT_ID=… \
 *   LEDGER_OIDC_USERNAME=… LEDGER_OIDC_PASSWORD=… \
 *   pnpm --filter @owarine/scripts exec tsx bootstrap-devnet.ts [--parties file] [--out file] [--seats 8] [--dry-run]
 *     [--check-only] [--shards 16] [--lanes crypto,cc,regular,gap,token,preipo,basket] [--reserve-seed 10000]
 *     [--no-tickets] [--no-games] [--allow-local] [--run <id>]
 *
 * Every write's commandId ends in the run id (`devnet-<base36 time>`, printed at the start). A write that meets
 * SUBMISSION_ALREADY_IN_FLIGHT waits for the pending submission (`@owarine/ledger`, up to `LEDGER_INFLIGHT_WAIT_MS`). If
 * a write still ends "outcome unknown", re-run with `--run <that id>`: the pending write is then resolved under its own
 * commandId (deduplicated if it landed, waited on if it is still in flight), never re-sent under a new one.
 *
 * `--allow-local` runs it against an unauthenticated local sandbox (the rehearsal: parties already allocated, DARs
 * already uploaded); rights do not apply there and are not checked.
 */
// The generated bindings log "Registered template …" for every template as they load: ~100 lines above the table.
import "../services/ops/src/actors/venue/quiet-codegen";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { ledgerClientFromEnv, ledgerConfigSummary, parseLedgerEnv } from "@owarine/ledger";
import type { CantonRole } from "../services/ops/src/runtime/keys";
import { arg, flag } from "./drive/cli";
import { repoDars } from "./bootstrap/dar";
import { authenticatedUser, verifyPackages, verifyParties } from "./bootstrap/devnet-checks";
import { DEFAULT_SEATS, parseDevnetParties } from "./bootstrap/devnet-parties";
import { acceptanceRow, errorEvidence, failed, table, type CheckRow } from "./bootstrap/rows";
import { valuationGate, valuationRefusal } from "./bootstrap/valuation-gate";
import { bootstrapVenue, POLICY_VERSION, type SentWrite } from "./bootstrap/venue";

const REPO = resolve(import.meta.dirname, "..");
const DEFAULT_FILE = join(homedir(), ".config", "owarine", "canton", "parties.devnet.json");
const log = (s: string) => console.log(`[devnet] ${s}`);
const insideRepo = (p: string) => !relative(REPO, resolve(p)).startsWith("..");

const env = parseLedgerEnv(process.env);
const local = env.LEDGER_AUTH_MODE === "none";
if (local && !flag("--allow-local")) {
  throw new Error("bootstrap-devnet needs LEDGER_AUTH_MODE=password (Noders). For a local rehearsal pass --allow-local.");
}
const client = ledgerClientFromEnv(env);
const dryRun = flag("--dry-run");
/** The command-id suffix of this run's writes; `--run` resumes an earlier run under the same command ids. */
const run = arg("--run", `devnet-${Date.now().toString(36)}`);
if (!/^[A-Za-z0-9-]{1,40}$/.test(run)) throw new Error("--run takes 1-40 letters, digits or '-' (it ends every command id)");
const seats = Number(arg("--seats", String(DEFAULT_SEATS)));
/** `~/…` expanded: an env file does not expand it, and a relative path would resolve inside the repo. */
const home = (p: string) => resolve(p.replace(/^~(?=\/|$)/, homedir()));
const input = home(arg("--parties", process.env.OWARINE_PARTIES_FILE || DEFAULT_FILE));
const out = home(arg("--out", input.endsWith(".json") ? input : DEFAULT_FILE));
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  } catch {
    return "—";
  }
})();

async function main(): Promise<number> {
  if (!Number.isInteger(seats) || seats < 1) throw new Error("--seats must be a positive integer");
  if (insideRepo(input) || insideRepo(out)) throw new Error("the parties file lives outside the repo (party ids never go into Git): use ~/.config/owarine/canton/");
  // C2z: a rehearsal's sandbox ids must never land in the file ops and the web read on DevNet.
  if (local && out === DEFAULT_FILE) throw new Error(`a local rehearsal never writes ${DEFAULT_FILE}: pass --out <file outside the repo>`);
  if (!existsSync(input)) throw new Error(`${input} does not exist: copy scripts/bootstrap/devnet-parties.example.json there and fill it`);
  const summary = ledgerConfigSummary(env);
  log(`ledger ${summary.url} (auth ${summary.mode})${dryRun ? ", DRY RUN: prepare only" : ""}, run ${run}`);

  const rows: CheckRow[] = [];
  const started = new Date().toISOString();
  try {
    rows.push({ check: "JSON API version", outcome: "pass", detail: `Canton ${(await client.version()).version}`, evidence: "GET /v2/version" });
  } catch (e) {
    rows.push({ check: "JSON API version", outcome: "fail", ...errorEvidence(e) });
    return finish(rows, [], started);
  }

  const parsed = parseDevnetParties(readFileSync(input, "utf8"), { seats });
  for (const w of parsed.warnings) log(`note: ${w}`);
  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) rows.push({ check: "parties file", outcome: "fail", detail: e });
    return finish(rows, [], started);
  }
  rows.push({ check: "parties file", outcome: parsed.warnings.length ? "warn" : "pass", detail: `${Object.keys(parsed.file.parties).length} roles, ${Object.keys(parsed.file.users ?? {}).length} users${parsed.warnings.length ? `; ${parsed.warnings.join("; ")}` : ""}` });

  let rightsOf: string | undefined;
  if (!local) {
    try {
      const me = await authenticatedUser(client);
      rightsOf = me.id;
      rows.push({ check: "token grant and ledger user", outcome: "pass", detail: `user ${me.id}`, evidence: "GET /v2/authenticated-user" });
    } catch (e) {
      rows.push({ check: "token grant and ledger user", outcome: "fail", ...errorEvidence(e) });
      return finish(rows, [], started);
    }
  }
  rows.push(...(await verifyParties(client, parsed.file, rightsOf === undefined ? {} : { rightsOf })));
  const dars = repoDars().filter((d) => (flag("--no-tickets") ? d.name !== "abu-pm-tickets" : true) && (flag("--no-games") ? d.name !== "abu-pm-games" : true));
  rows.push(...(await verifyPackages(client, dars)));
  // C8j.2: `valuation` registers only while the venue's Pyth key reads every valuation index (D-125, no dead lane).
  const lanes = new Set(arg("--lanes", "crypto,cc,regular,gap,token,preipo,basket").split(",").map((s) => s.trim()));
  const gate = await valuationGate(lanes, { key: process.env.PYTH_API_KEY || undefined });
  if (gate.requested) rows.push({ check: "valuation lanes entitled", outcome: gate.entitled ? "pass" : "fail", detail: gate.entitled ? gate.lines.join(" · ") : valuationRefusal(gate), evidence: "GET hermes /v2/updates/price/latest per index" });
  console.log(table(rows));
  if (failed(rows) || flag("--check-only")) return finish(rows, [], started);

  const writes: SentWrite[] = [];
  try {
    await bootstrapVenue({
      client,
      parties: parsed.file.parties as Record<CantonRole, string>,
      dryRun,
      run,
      shards: Number(arg("--shards", process.env.VENUE_SHARDS ?? "16")),
      shardBase: BigInt(arg("--shard-base", "2000000000")),
      lanes,
      reserveSeedBase: BigInt(arg("--reserve-seed", "10000")) * 1_000_000n,
      tickets: !flag("--no-tickets"),
      maker: !flag("--no-maker"),
      games: !flag("--no-games"),
      log,
      onWrite: (w) => writes.push(w),
    });
  } catch (e) {
    rows.push({ check: "bootstrap writes", outcome: "fail", ...errorEvidence(e) });
    // Same command ids on the next run: a write whose outcome is unknown is never re-sent under a new one.
    log(`a write failed. To resume, re-run the same command with --run ${run}`);
    return finish(rows, writes, started);
  }
  rows.push({ check: "bootstrap writes", outcome: "pass", detail: `${writes.length} ${dryRun ? "prepared" : "executed"}${writes.length === 0 ? " (everything was already on the ledger)" : ""}` });

  if (!dryRun) {
    const file = { ...parsed.file, createdAtMs: Date.now(), policyVersion: POLICY_VERSION };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
    log(`wrote ${out} (the file ops and the web read: OWARINE_PARTIES_FILE)`);
  }
  return finish(rows, writes, started);
}

function finish(rows: CheckRow[], writes: SentWrite[], atIso: string): number {
  console.log("\n--- acceptance rows (docs/plan/acceptance.md) ---");
  const o = { stage: "C2y", commit, atIso, prefix: "DevNet bootstrap: " };
  for (const r of rows) console.log(acceptanceRow(r, o));
  for (const w of writes) {
    console.log(acceptanceRow({ check: `${w.dry ? "prepared" : "sent"} ${w.commandId} as ${w.role} (${w.commands} command${w.commands === 1 ? "" : "s"})`, outcome: "pass", detail: w.dry ? "prepared, not executed" : "committed", evidence: w.updateId ? `update ${w.updateId}` : "prepare" }, o));
  }
  return failed(rows) ? 1 : 0;
}

process.exitCode = await main();
