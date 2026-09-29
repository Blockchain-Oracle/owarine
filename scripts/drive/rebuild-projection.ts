// Rebuild == live (C3 gate): with ops stopped, catch the live projection up to the ledger end, replay the venue's whole
// ledger from offset 0 into a second database, and compare every idx_* table row for row.
//   DATABASE_URL=… REBUILD_DATABASE_URL=… VENUE_PARTY=… LEDGER_JSON_API_URL=… \
//     pnpm --filter @agari/scripts exec tsx drive/rebuild-projection.ts
// Exits 0 only when every table is equal. The rebuild database is truncated first.
import postgres from "postgres";
import { ensureSchema, getDb, indexWriter, SCHEMA_SQL, type Db } from "@agari/db";
import { ledgerClientFromEnv, parseLedgerEnv } from "@agari/ledger";
import { startProjectorLoop } from "../../services/ops/src/actors/projector/run";

const TABLES: Record<string, string> = {
  idx_updates: "SELECT update_id, ledger_offset, effective_at_ms, command_id, events FROM idx_updates ORDER BY ledger_offset",
  idx_events: "SELECT update_id, node_id, kind, template, contract_id, choice, market, data FROM idx_events ORDER BY ledger_offset, node_id",
  idx_series: "SELECT * FROM idx_series ORDER BY series",
  idx_markets: "SELECT * FROM idx_markets ORDER BY market",
  idx_prints: "SELECT * FROM idx_prints ORDER BY oracle, symbol, boundary_sec",
  idx_quotes: "SELECT * FROM idx_quotes ORDER BY quote_cid",
  idx_legs: "SELECT * FROM idx_legs ORDER BY leg_cid",
  idx_fills: "SELECT * FROM idx_fills ORDER BY update_id, node_id",
  idx_positions: "SELECT * FROM idx_positions ORDER BY market, owner_party",
  idx_candles: "SELECT * FROM idx_candles ORDER BY market, bucket_sec",
  idx_publications: "SELECT * FROM idx_publications ORDER BY publication_cid",
};

const dump = async (db: Db) => Object.fromEntries(await Promise.all(Object.entries(TABLES).map(async ([t, sql]) => [t, await db.unsafe(sql)] as const)));
const text = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

const db = getDb();
const party = process.env.VENUE_PARTY;
const rebuildUrl = process.env.REBUILD_DATABASE_URL;
if (!db || !party || !rebuildUrl) {
  console.error("DATABASE_URL, REBUILD_DATABASE_URL and VENUE_PARTY are required");
  process.exit(2);
}
const env = parseLedgerEnv();
const ledger = ledgerClientFromEnv(env);
const end = await ledger.ledgerEnd();
const stream = process.env.PROJECTOR_STREAM ?? "venue";
const base = { ledger, baseUrl: env.LEDGER_JSON_API_URL, auth: ledger.auth, party, stream, log: () => undefined };

await ensureSchema();
const live = startProjectorLoop({ db, ...base });
await live.waitFor(end, 180_000);
await live.stop();
console.log(`live projection caught up to ledger end ${end}`);

const rdb = postgres(rebuildUrl, { max: 2, onnotice: () => undefined }) as unknown as Db;
await rdb.unsafe(SCHEMA_SQL);
await indexWriter(rdb).truncate();
const t0 = Date.now();
const replay = startProjectorLoop({ db: rdb, ...base });
await replay.waitFor(end, 300_000);
await replay.stop();
console.log(`rebuild from offset 0 reached ${end} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const [a, b] = [await dump(db), await dump(rdb)];
let diffs = 0;
for (const t of Object.keys(TABLES)) {
  const same = text(a[t]) === text(b[t]);
  if (!same) diffs++;
  console.log(`  ${same ? "=" : "≠"} ${t.padEnd(18)} live ${String(a[t]!.length).padStart(6)}  rebuilt ${String(b[t]!.length).padStart(6)}`);
}
await rdb.end();
await db.end();
console.log(diffs === 0 ? "rebuild equals live: zero differences" : `rebuild differs from live in ${diffs} table(s)`);
process.exit(diffs === 0 ? 0 : 1);
