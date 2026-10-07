// Dev runner for the projector alone.
//   pnpm --filter @owarine/ops exec tsx --env-file-if-exists=../../.env.local src/dev/projector.ts [--rebuild] [--once]
// --rebuild truncates every idx_ table first (a full replay from offset 0); --once catches up to the ledger end as it
// is at start, prints the status row and exits. Env: DATABASE_URL, VENUE_PARTY, LEDGER_JSON_API_URL (+ LEDGER_AUTH_MODE…).
import { getDb, indexReader, indexWriter } from "@owarine/db";
import { ledgerClientFromEnv, parseLedgerEnv } from "@owarine/ledger";
import { startProjector } from "../actors/projector";
import { redact } from "../runtime";

const log = (why: string) => console.log(JSON.stringify({ tsMs: Date.now(), actor: "projector", why: redact(why) }));
const db = getDb();
if (!db) throw new Error("DATABASE_URL is not set");

if (process.argv.includes("--rebuild")) {
  await indexWriter(db).truncate().catch(() => undefined);
  log("truncated every idx_ table: full replay from offset 0");
}

const started = await startProjector({ log });
if (!started) process.exit(1);

if (process.argv.includes("--once")) {
  const t0 = Date.now();
  const end = await ledgerClientFromEnv(parseLedgerEnv()).ledgerEnd();
  await started.projector.waitFor(end, 120_000);
  log(`caught up to offset ${end} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(JSON.stringify(await indexReader(db).status(process.env.PROJECTOR_STREAM ?? "venue"), null, 2));
  await started.stop();
  await db.end();
  process.exit(0);
}
