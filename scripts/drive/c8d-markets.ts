/**
 * The C8d lane's drive against a running local stack: a sandbox, the real ops process (`services/ops/src/main.ts`) and
 * the real web app. Each check prints one `docs/plan/acceptance.md`-shaped row with its update id; the run exits 1 if
 * any row failed. Parts run in the order given by `--only` (default: all).
 *
 *   basket, valuation   C8d (`drive/c8d/baskets.ts`)
 *   venue-mode          C-DAML-02 (`drive/c8d/venue-mode.ts`; needs OPS_ADMIN_SECRET, ops' own)
 *   products, knockout  C-OPS-09, C-DAML-03 (`drive/c8d/products.ts`; needs DATABASE_URL, the projection)
 *   strategies, mirror  L-57, A-3b, L-54 (`drive/c8d/strategies.ts`)
 *   private             L-39 (`drive/c8d/private.ts`)
 *
 *   LEDGER_JSON_API_URL=http://localhost:7604 AGARI_PARTIES_FILE=<parties.json> \
 *     pnpm --filter @agari/scripts exec tsx drive/c8d-markets.ts --web http://localhost:3160 --ops http://localhost:8760 [--only basket,valuation]
 */
import "../../services/ops/src/actors/venue/quiet-codegen";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { ledgerClientFromEnv, parseLedgerEnv } from "@agari/ledger";
import { parseMarketsEnv } from "@agari/markets";
import { acceptanceRow, errorEvidence, failed, table, type CheckRow } from "../bootstrap/rows";
import { arg } from "./cli";
import { webClient } from "./first-call/seat";
import { runBaskets, runValuation } from "./c8d/baskets";
import { runPrivate } from "./c8d/private";
import { runKnockout, runProducts } from "./c8d/products";
import { runMirror, runStrategies } from "./c8d/strategies";
import { runVenueMode } from "./c8d/venue-mode";
import { ledgerKit, readParties, rolesOf, type Ctx } from "./c8d/common";

const REPO = resolve(import.meta.dirname, "..", "..");
const PARTS: Record<string, (ctx: Ctx) => Promise<void>> = { basket: runBaskets, valuation: runValuation, "venue-mode": runVenueMode, products: runProducts, knockout: runKnockout, strategies: runStrategies, mirror: runMirror, private: runPrivate };
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
  const partiesPath = process.env.AGARI_PARTIES_FILE;
  if (!partiesPath) throw new Error("AGARI_PARTIES_FILE is not set");
  const parties = readParties(partiesPath);
  const roles = rolesOf(parties);
  const run = `c8d-${Date.now().toString(36)}`;
  const webUrl = arg("--web", "http://localhost:3160");
  const ctx: Ctx = {
    client, parties, roles, run, webUrl,
    opsUrl: arg("--ops", "http://localhost:8760"),
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
      console.log(acceptanceRow(row, { stage: "C8d", commit, atIso: new Date().toISOString(), prefix: "local: " }));
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
