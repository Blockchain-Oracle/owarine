/**
 * The C2e lane's drive (abu-pm-main 0.5.2, K-315) against a running local stack: a sandbox bootstrapped from
 * `daml/released/`, the real ops process and the real web app. Each check prints one `docs/plan/acceptance.md`-shaped row
 * with its update id; the run exits 1 if any row failed. Parts run in the order given by `--only` (default: all).
 *
 *   payout  a private Up and Down on one Window settle straight into the private bucket (`drive/c2e/private-payout.ts`)
 *   void    a private call on a voided Window comes back, stake and fee, into the private bucket (the operator stops ops
 *           from before the Window's expiry until after its close deadline, on the drive's `C2E-VOID-PLACED` line)
 *   out     the private balance moves back to the seat's balance
 *   guard   ops refuses to cash out a receipt already paid into the private bucket (needs OPS_INTERNAL_SECRET)
 *
 *   LEDGER_JSON_API_URL=http://localhost:7904 OWARINE_PARTIES_FILE=<parties.json> \
 *     pnpm --filter @owarine/scripts exec tsx drive/c2e-private-payout.ts --web http://localhost:3190 --ops http://localhost:8790 [--only payout,void,out]
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { ledgerClientFromEnv, parseLedgerEnv } from "@owarine/ledger";
import { parseMarketsEnv } from "@owarine/markets";
import { acceptanceRow, errorEvidence, failed, table, type CheckRow } from "../bootstrap/rows";
import { arg } from "./cli";
import { webClient } from "./first-call/seat";
import { runGuard, runOut, runPayout, runVoid } from "./c2e/private-payout";
import { ledgerKit, readParties, rolesOf, type Ctx } from "./c8d/common";

const REPO = resolve(import.meta.dirname, "..", "..");
const PARTS: Record<string, (ctx: Ctx) => Promise<void>> = { payout: runPayout, void: runVoid, out: runOut, guard: runGuard };
const only = arg("--only", Object.keys(PARTS).join(",")).split(",").map((s) => s.trim()).filter(Boolean);
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  } catch {
    return "—";
  }
})();
const rows: CheckRow[] = [];

async function main(): Promise<number> {
  const client = ledgerClientFromEnv(parseLedgerEnv(process.env));
  const partiesPath = process.env.OWARINE_PARTIES_FILE;
  if (!partiesPath) throw new Error("OWARINE_PARTIES_FILE is not set");
  const parties = readParties(partiesPath);
  const roles = rolesOf(parties);
  const run = `c2e-${Date.now().toString(36)}`;
  const webUrl = arg("--web", "http://localhost:3190");
  const ctx: Ctx = {
    client, parties, roles, run, webUrl,
    opsUrl: arg("--ops", "http://localhost:8790"),
    kit: ledgerKit(client, roles, run),
    web: webClient(webUrl, parseMarketsEnv({ cluster: process.env.NEXT_PUBLIC_CANTON_NETWORK ?? "localnet" }).cluster),
    seats: new Map(),
    log: (s) => console.log(`  · ${s}`),
    step: async (check, body) => {
      let row: CheckRow;
      try {
        const r = await body();
        if (!r) return true;
        row = { check, ...r };
      } catch (e) {
        row = { check, outcome: "fail", ...errorEvidence(e) };
      }
      rows.push(row);
      console.log(acceptanceRow(row, { stage: "C2e", commit, atIso: new Date().toISOString(), prefix: "local: " }));
      return row.outcome !== "fail";
    },
  };
  for (const name of only) {
    const part = PARTS[name];
    if (!part) throw new Error(`unknown part ${name} (known: ${Object.keys(PARTS).join(", ")})`);
    console.log(`\n## ${name}`);
    await part(ctx);
  }
  console.log(`\n${table(rows)}`);
  return failed(rows) ? 1 : 0;
}

process.exit(await main());
