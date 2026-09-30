/**
 * The four-viewpoint first call (C4 gate, M1; rehearsed in C2z). Every step prints a `docs/plan/acceptance.md` row with
 * its update ids, failures included. Rows name parties by hint only (`pm-seat-3::…`).
 *
 *   main   Seat A (Alice) and seat B (Bob) lease through `/api/seat`. A gets a firm quote from ops on the real lane
 *          (`--lane BTC-1m`). The drive prepares A's `Quote_Accept` without executing it (the dry run shows the cost),
 *          then A accepts through the web. B quotes the other side and accepts through the drop proxy: the response
 *          is killed, the same commandId is re-sent, and B must hold exactly one Leg. Four viewpoints are read next:
 *          A's owner view shows the leg, B's view holds none of A's contracts, `/api/view?as=outsider` returns
 *          nothing (its literal query body is printed), and the venue sees both legs. Then ops' three oracles attest,
 *          the resolver resolves and the venue settles. Neither seat signs anything after its accept.
 *   void   On the drive's own Series, A accepts a venue quote. The three oracles post disagreeing opens, the resolver
 *          records the open, and the Window voids. A gets cost plus fee back: from ops' settler, else by A's claim.
 *   stale  With ops stopped (local: `--ops-pid`, frozen by SIGSTOP; DevNet: `--ops-stopped`), A accepts on a Window
 *          nobody resolves. After `refundAfter`, A takes backing plus fee back through `/api/ledger/legs/refund-stale`.
 *
 *   local   LEDGER_AUTH_MODE=none LEDGER_JSON_API_URL=http://localhost:7525 \
 *             pnpm --filter @agari/scripts exec tsx drive/first-call.ts --network local --parties <file> --ops-pid <pid>
 *   devnet  pnpm --filter @agari/scripts exec tsx --env-file=$HOME/.config/agari/canton/devnet.env drive/first-call.ts \
 *             --network devnet --web https://<web domain> [--only main,void] [--only stale --ops-stopped]
 *
 * Options: --lane BTC-1m · --stake 62 (credits) · --ops <url> · --only main,void,stale · --stage C2z.
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ledgerClientFromEnv, parseLedgerEnv } from "@agari/ledger";
import { parseMarketsEnv } from "@agari/markets";
import { parseDevnetParties, shortParty } from "../bootstrap/devnet-parties";
import { acceptanceRow, errorEvidence, failed, table, type CheckRow } from "../bootstrap/rows";
import { firstCallConfig, rowPrefix, type FirstCallConfig } from "./first-call/config";
import { ledgerKit, type Roles } from "./first-call/ledger";
import { newSeat, webClient } from "./first-call/seat";
import { runMain, runStale, runVoid, type Ctx } from "./first-call/steps";

const REPO = resolve(import.meta.dirname, "..", "..");
const parsedConfig = firstCallConfig(process.argv.slice(2), process.env, { home: homedir(), repo: REPO });
if ("error" in parsedConfig) {
  console.error(`first-call: ${parsedConfig.error}`);
  process.exit(2);
}
const config: FirstCallConfig = parsedConfig;
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  } catch {
    return "—";
  }
})();

const rows: Array<CheckRow & { atIso: string }> = [];
const rowOpts = { stage: config.stage, commit, prefix: rowPrefix(config.network) };
function record(r: CheckRow): void {
  const row = { ...r, atIso: new Date().toISOString() };
  rows.push(row);
  console.log(acceptanceRow(row, { ...rowOpts, atIso: row.atIso }));
}
/** Runs one step: a thrown error becomes its fail row, and the drive goes on to the next step. */
async function step(check: string, body: () => Promise<Omit<CheckRow, "check"> | null>): Promise<boolean> {
  try {
    const r = await body();
    if (r) record({ check, ...r });
    return r?.outcome !== "fail";
  } catch (e) {
    record({ check, outcome: "fail", ...errorEvidence(e) });
    return false;
  }
}

async function main(): Promise<number> {
  const started = new Date().toISOString();
  const env = parseLedgerEnv(process.env);
  const client = ledgerClientFromEnv(env);
  const parsed = parseDevnetParties(readFileSync(config.partiesPath, "utf8"));
  const missing = parsed.errors.concat(["alice", "bob", "outsider"].filter((p) => !parsed.file.users?.[p]).map((p) => `users.${p}: missing`));
  if (missing.length) {
    record({ check: "parties file", outcome: "fail", detail: missing.join("; ") });
    return 1;
  }
  const p = parsed.file.parties;
  const roles: Roles = { venue: p.venue!, resolver: p.resolver!, auditor: p.auditor!, oracles: [p["oracle-coinbase"]!, p["oracle-kraken"]!, p["oracle-bitstamp"]!] };
  const run = Date.now().toString(36);
  const web = webClient(config.web, parseMarketsEnv(process.env).cluster);
  const ctx: Ctx = {
    config, client, roles, personas: { alice: parsed.file.users!.alice!, bob: parsed.file.users!.bob!, outsider: parsed.file.users!.outsider! },
    kit: ledgerKit(client, roles, run), web, step, run,
    seats: { A: await newSeat("seat A (Alice)"), B: await newSeat("seat B (Bob)") },
    log: (s) => console.log(`[first-call] ${s}`),
  };
  ctx.log(`${config.network}: ledger ${env.LEDGER_JSON_API_URL}, web ${config.web}, ops ${config.ops ?? "not reachable from here"}, steps ${[...config.steps].join(",")}`);

  const up = await step("preflight", async () => {
    const v = await client.version();
    const seat = await web.call(null, "GET", "/api/seat");
    if (seat.status >= 500 || seat.json.kind === "not-live") return { outcome: "fail", detail: `the web's seat routes are not live (${seat.status} ${seat.json.reason ?? seat.json.kind ?? ""})`, evidence: "GET /api/seat" };
    return { outcome: "pass", detail: `Canton ${v.version}; the web answers /api/seat; venue ${shortParty(roles.venue)}`, evidence: "GET /v2/version" };
  });
  if (!up) return finish(started);

  const leased = await step("lease seat A (Alice) and seat B (Bob)", async () => {
    const out: string[] = [];
    for (const seat of [ctx.seats.A, ctx.seats.B]) {
      const r = await web.lease(seat);
      if (r.json.kind !== "leased") return { outcome: "fail", detail: `${seat.name}: ${r.status} ${r.json.kind ?? ""} ${JSON.stringify(r.json.diagnosis ?? r.json).slice(0, 160)}`, evidence: "POST /api/seat" };
      out.push(`${seat.name} → ${shortParty(seat.party!)} lease ${seat.leaseId}${r.json.funded ? ", funded" : ""}`);
    }
    return { outcome: ctx.seats.A.party !== ctx.seats.B.party ? "pass" : "fail", detail: out.join("; "), evidence: "POST /api/seat ×2" };
  });
  if (!leased) return finish(started);

  try {
    if (config.steps.has("main")) await runMain(ctx);
    if (config.steps.has("void")) await runVoid(ctx);
    if (config.steps.has("stale")) await runStale(ctx);
  } finally {
    for (const seat of [ctx.seats.A, ctx.seats.B]) await web.call(seat, "DELETE", "/api/seat").catch(() => undefined);
  }
  return finish(started);
}

function finish(started: string): number {
  console.log(`\n${table(rows)}\n\n--- acceptance rows (docs/plan/acceptance.md), run from ${started} ---`);
  for (const r of rows) console.log(acceptanceRow(r, { ...rowOpts, atIso: r.atIso }));
  const bad = failed(rows);
  console.log(bad ? `\n${rows.filter((r) => r.outcome === "fail").length} STEP(S) FAILED` : "\nALL STEPS PASSED");
  return bad ? 1 : 0;
}

process.exitCode = await main();
