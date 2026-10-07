// Independent recount of the projection against the ledger (research 02 map item 12).
//   pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/verify-projection.ts [--json]
// Env: DATABASE_URL, VENUE_PARTY, LEDGER_JSON_API_URL (+ LEDGER_AUTH_MODE and its variables), PROJECTOR_STREAM.
// Exits 0 when the ledger's active contracts at the cursor offset equal the projection's live rows, else 1.
import { getDb } from "@owarine/db";
import { ledgerClientFromEnv, parseLedgerEnv } from "@owarine/ledger";
import { verifyProjection } from "../../services/ops/src/actors/projector/verify";
import { flag } from "./cli";

const db = getDb();
const party = process.env.VENUE_PARTY;
if (!db || !party) {
  console.error("DATABASE_URL and VENUE_PARTY are required");
  process.exit(2);
}
const report = await verifyProjection({ db, ledger: ledgerClientFromEnv(parseLedgerEnv()), party, stream: process.env.PROJECTOR_STREAM ?? "venue" });
await db.end();
if (flag("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verify-projection at offset ${report.offset ?? "-"}: ${report.ok ? "OK, zero diffs" : `${report.mismatches.length} mismatch(es)`}`);
  for (const t of Object.keys(report.ledger)) console.log(`  ${t.padEnd(28)} ledger ${String(report.ledger[t]).padStart(5)}  projection ${String(report.projection[t]).padStart(5)}`);
  for (const m of report.mismatches) console.log(`  ✗ ${m}`);
}
process.exit(report.ok ? 0 : 1);
