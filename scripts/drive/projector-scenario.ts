// The projector's integration scenario on a LOCAL sandbox (C3a): drives the PM engine through every event family the
// projector maps, kills the projector (SIGKILL) mid-stream and restarts it, then checks the rows, runs the independent
// ACS recount and replays the whole ledger into a second database to prove rebuild == live.
//
//   LEDGER_JSON_API_URL=http://localhost:7585 DATABASE_URL=postgres://…/pm_c3a REBUILD_DATABASE_URL=postgres://…/pm_c3a_rebuild \
//     pnpm exec tsx scripts/drive/projector-scenario.ts
//
// Needs the abu-pm-main DAR on the sandbox (`dpm sandbox --dar …`). Exits 0 only when every check passes.
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { marketIdFromDaml } from "@owarine/core/market";
import { crowdFlow, ensureSchema, getDb, indexReader, indexWriter, marketIdOfKey, resolutionsByMarket, tapeFills, type Db } from "@owarine/db";
import { noAuth } from "@owarine/ledger";
import { startProjectorLoop } from "../../services/ops/src/actors/projector/run";
import { verifyProjection } from "../../services/ops/src/actors/projector/verify";
import { localSession, sleep } from "./pm-ledger";
import { CASH_UNIT, cast, recordOpens, resolve, settle, setup, staleRefund, trade, type World } from "./projector-steps";

const URL_ = process.env.LEDGER_JSON_API_URL ?? "http://localhost:7585";
const REBUILD_URL = process.env.REBUILD_DATABASE_URL;
const USER = "owarine-c3a";
const root = fileURLToPath(new URL("../../", import.meta.url));
const log = (line: string) => console.log(`[scenario] ${line}`);
const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures.push(label);
};

function spawnProjector(venue: string, logPath: string): ChildProcess {
  const child = spawn(`${root}node_modules/.bin/tsx`, [`${root}services/ops/src/dev/projector.ts`], {
    env: { ...process.env, VENUE_PARTY: venue, LEDGER_AUTH_MODE: "none", LEDGER_USER_ID: USER, LEDGER_JSON_API_URL: URL_, PROJECTOR_HEARTBEAT_MS: "2000" },
    stdio: ["ignore", "pipe", "pipe"],
    // Its own process group: the tsx launcher forks node, and a kill must reach the node process itself.
    detached: true,
  });
  const out = createWriteStream(logPath, { flags: "a" });
  child.stdout!.pipe(out);
  child.stderr!.pipe(out);
  return child;
}

function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    process.kill(-child.pid!, signal);
  } catch {
    child.kill(signal);
  }
}

async function cursorOf(db: Db): Promise<number> {
  const [row] = await db<{ o: string }[]>`SELECT ledger_offset::text AS o FROM idx_cursor WHERE stream = 'venue'`;
  return row ? Number(row.o) : -1;
}

async function waitCursor(db: Db, target: number, label: string): Promise<void> {
  const t0 = Date.now();
  while ((await cursorOf(db)) < target) {
    if (Date.now() - t0 > 90_000) throw new Error(`${label}: projector never reached offset ${target} (at ${await cursorOf(db)})`);
    await sleep(250);
  }
  log(`${label}: cursor at or past ${target} after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

/** Every projection table, ordered by its key, minus the wall-clock columns a replay cannot reproduce. */
async function dump(db: Db): Promise<Record<string, unknown[]>> {
  const q: Record<string, string> = {
    idx_updates: "SELECT update_id, ledger_offset, effective_at_ms, command_id, events FROM idx_updates ORDER BY ledger_offset",
    idx_events: "SELECT update_id, node_id, kind, template, contract_id, choice, market, data FROM idx_events ORDER BY ledger_offset, node_id",
    idx_series: "SELECT * FROM idx_series ORDER BY series",
    idx_markets: "SELECT * FROM idx_markets ORDER BY market",
    idx_prints: "SELECT * FROM idx_prints ORDER BY oracle, symbol, boundary_sec, contract_id",
    idx_quotes: "SELECT * FROM idx_quotes ORDER BY quote_cid",
    idx_legs: "SELECT * FROM idx_legs ORDER BY leg_cid",
    idx_fills: "SELECT * FROM idx_fills ORDER BY update_id, node_id",
    idx_positions: "SELECT * FROM idx_positions ORDER BY market, owner_party",
    idx_candles: "SELECT * FROM idx_candles ORDER BY market, bucket_sec",
    idx_publications: "SELECT * FROM idx_publications ORDER BY publication_cid",
  };
  const out: Record<string, unknown[]> = {};
  for (const [t, sql] of Object.entries(q)) out[t] = await db.unsafe(sql);
  return out;
}

async function checkRows(w: World, db: Db): Promise<void> {
  const { alice, bob } = w.p;
  const cu = BigInt(CASH_UNIT);
  const m = Object.fromEntries((await db<{ market_key: string; state: string; winner: number; void_reason: number | null; void_detail: string | null; quotes_issued: number; quotes_expired: number; quotes_withdrawn: number; quotes_accepted: number; trade_count: string; participants: number; legs_open: number }[]>`
    SELECT market_key, state, winner, void_reason, void_detail, quotes_issued, quotes_expired, quotes_withdrawn, quotes_accepted, trade_count::text, participants, legs_open FROM idx_markets`).map((r) => [r.market_key, r]));
  const [A, B, C] = [m[w.win.A.key], m[w.win.B.key], m[w.win.C.key]];
  check(Object.keys(m).length === 3, "three Windows projected");
  check(A?.state === "resolved" && A.winner === 0, "A resolved Up (winner 0)");
  check(B?.state === "voided" && B.winner === 2 && B.void_reason === 2 && B.void_detail === "SourceDisagreement:CloseSlot", "B voided: source disagreement at the close");
  check(C?.state === "resolved" && C.winner === 1, "C resolved Down (winner 1)");
  check(A?.trade_count === "4" && B?.trade_count === "2" && C?.trade_count === "1", "fills per Window: A 4 (3 buys + 1 sale), B 2, C 1");
  check(C?.quotes_issued === 4 && C.quotes_expired === 1 && C.quotes_withdrawn === 1 && C.quotes_accepted === 1, "C quotes: 4 issued (one a live buy-back), 1 accepted, 1 expired, 1 withdrawn");
  const [q] = await db<{ n: number; open: number }[]>`SELECT count(*)::int AS n, count(*) FILTER (WHERE status = 'issued')::int AS open FROM idx_quotes`;
  check(q?.n === 9 && q.open === 2, "idx_quotes: 7 accepted + 2 live; expired and withdrawn rows were deleted");
  const legs = Object.fromEntries((await db<{ leg_cid: string; status: string; result: string | null; payout_base: string | null }[]>`SELECT leg_cid, status, result, payout_base::text FROM idx_legs`).map((r) => [r.leg_cid, r]));
  const L = w.legs;
  const is = (name: string, status: string, result: string | null, payout: bigint | null) => {
    const r = legs[L[name]!];
    check(r?.status === status && r.result === result && (payout === null || r.payout_base === payout.toString()), `${name}: ${status}${result ? ` ${result}` : ""}${payout !== null ? ` paid ${payout}` : ""} (got ${r?.status} ${r?.result} ${r?.payout_base})`);
  };
  is("A-alice", "settled", "won", 10n * 1000n * cu);
  is("A-bob", "settled", "lost", 0n);
  is("A-bob2", "sold", null, 5n * 500n * cu);
  is("A-alice/venue", "merged", null, null);
  is("A-bob/venue", "merged", null, 0n);
  is("B-alice", "settled", "void", 20n * 500n * cu + 10n);
  is("B-bob", "settled", "void", 20n * 500n * cu + 10n);
  is("C-alice", "refunded_stale", null, 7n * 300n * cu + 2n);
  is("C-alice/venue", "settled", "won", 7n * 1000n * cu);
  const marketA = marketIdOfKey(w.win.A.key);
  const [pa] = await db<Record<string, string | boolean | number>[]>`SELECT bought_yes_lots::text, paid_ticklots::text, fees_paid_base::text, payout_base::text, redeemed, redeemed_by_crank, open_legs FROM idx_positions WHERE market = ${marketA} AND owner_party = ${alice}`;
  check(pa?.bought_yes_lots === "10" && pa.paid_ticklots === "6000" && pa.fees_paid_base === "5" && pa.payout_base === (10n * 1000n * cu).toString() && pa.redeemed === true && pa.redeemed_by_crank === true, "alice's A position: bought 10 Up for 6000 ticklots + fee 5, paid 10,000,000 by the settler");
  const [pb] = await db<Record<string, string | number>[]>`SELECT bought_yes_lots::text, sold_yes_lots::text, bought_no_lots::text, received_ticklots::text, open_legs, fills FROM idx_positions WHERE market = ${marketA} AND owner_party = ${bob}`;
  check(pb?.bought_yes_lots === "5" && pb.sold_yes_lots === "5" && pb.bought_no_lots === "10" && pb.received_ticklots === "2500" && pb.open_legs === 0 && pb.fills === 3, "bob's A position: 10 Down + 5 Up bought, the 5 Up sold back for 2500 ticklots, no open leg");
  const [pc] = await db<{ refunded_stale: boolean; refunded_base: string }[]>`SELECT refunded_stale, refunded_base::text FROM idx_positions WHERE market = ${marketIdOfKey(w.win.C.key)} AND owner_party = ${alice}`;
  check(pc?.refunded_stale === true && pc.refunded_base === (7n * 300n * cu + 2n).toString(), "alice's C position: refunded_stale, backing + fee returned");
  const pubs = await db<{ handle: string }[]>`SELECT handle FROM idx_publications ORDER BY handle`;
  check(pubs.length === 2 && pubs.every((p) => p.handle === "alice"), "publications: alice's two; bob's retracted one is gone");
  const [pr] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM idx_prints`;
  check(pr?.n === 18, "idx_prints: 3 oracles × 3 symbols × 2 boundaries = 18");
  const [dup] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM (SELECT ledger_offset FROM idx_updates GROUP BY 1 HAVING count(*) > 1) d`;
  check(dup?.n === 0, "no update projected twice after the kill and restart");

  const r = indexReader(db);
  const rows = await r.markets({ ids: [marketA] });
  check(rows[0]?.volume_ticklots === "0" && rows[0]?.stats_public === false && rows[0]?.book === w.win.A.termsCid, "markets(A): 2 participants < k=5, so volume reads 0; book = terms cid");
  const prints = rows[0]?.prints as Record<string, { price: string; signers: number }> | undefined;
  check(prints?.["0"]?.price === "6000100000000" && prints["1"]?.price === "6010100000000" && prints["0"].signers === 3, "markets(A).prints: open and close quorum medians, 3 signers");
  check((await r.walletFills(alice)).length === 3, "walletFills(alice) as her party: 3 fills (A, B, C)");
  check((await r.walletActions(alice)).filter((a) => a.name === "Redeemed").length === 3, "walletActions(alice): 3 Redeemed rows (A settle, B void settle, C stale refund)");
  check((await r.positions(bob)).length === 2, "positions(bob): A and B");
  check((await r.candles(marketA, 0, 2 ** 31)).length === 0, "candles(A) withheld below k=5");
  const tape = await tapeFills(db, { sinceSec: 0, untilSec: 2 ** 31 });
  check(tape.length === 2 && tape.every((f) => f.taker === "alice"), "tape/fills: only alice's two published trades, identified by her handle");
  check((await r.fills({ market: marketA })).length === 1, "fills?market=A: the one published trade");
  check((await crowdFlow(db, 0)) === null, "sentiment: null below 5 publishers");
  check(marketA === marketIdFromDaml(w.win.A.key) && rows[0]?.market === marketA, "idx_markets.market is the app MarketId (marketIdFromDaml of the Daml marketId)");
  const res = await resolutionsByMarket(db, { markets: [marketA, marketIdOfKey(w.win.B.key)] });
  const ra = res.get(w.win.A.termsCid);
  const rb = res.get(w.win.B.termsCid);
  check(res.size === 2 && ra?.outcome === "up" && ra.cid === w.win.A.resolutionCid && ra.marketId === marketA, "resolutionsByMarket: A resolved up, keyed by terms cid, with the app MarketId");
  check(rb?.outcome === null && rb.voidReason === "SourceDisagreement", "resolutionsByMarket: B void, reason SourceDisagreement");
  check(Boolean(ra?.disclosure?.createdEventBlob) && Boolean(ra?.disclosure?.synchronizerId) && ra?.disclosure?.contractId === ra?.cid, "resolutionsByMarket: A carries its disclosure (blob, template, synchronizer)");
  // The disclosure must match what the ledger itself serves for that contract.
  const acs = await w.s.c.activeContracts({ parties: [w.p.venue], templateIds: ["#abu-pm-main:PM.Market:Resolution"], includeCreatedEventBlob: true });
  const live = acs.contracts.find((c) => c.createdEvent.contractId === ra?.cid);
  check(live?.createdEvent.createdEventBlob === ra?.disclosure?.createdEventBlob && live?.synchronizerId === ra?.disclosure?.synchronizerId, "resolutionsByMarket: blob and synchronizer equal the ACS's");
}

async function recount(db: Db, s: Awaited<ReturnType<typeof localSession>>, venue: string, label: string): Promise<void> {
  console.log(`\nverify-projection, ${label} (independent ACS recount):`);
  const report = await verifyProjection({ db, ledger: s.c, party: venue });
  for (const t of Object.keys(report.ledger)) console.log(`    ${t.padEnd(28)} ledger ${String(report.ledger[t]).padStart(4)}  projection ${String(report.projection[t]).padStart(4)}`);
  for (const m of report.mismatches) console.log(`    ✗ ${m}`);
  check(report.ok, `verify-projection at offset ${report.offset}: zero diffs`);
}

async function main(): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is required");
  await ensureSchema();
  await indexWriter(db).truncate();
  const s = await localSession(URL_, USER);
  const p = await cast(s);
  log(`sandbox ${URL_}; venue ${p.venue.slice(0, 24)}…`);
  const logPath = process.env.PROJECTOR_LOG ?? "/dev/null";
  let child = spawnProjector(p.venue, logPath);

  const w = await setup(s, p, log);
  await recordOpens(w);
  await waitCursor(db, w.maxOffset, "live before the kill");
  await trade(w);
  killGroup(child, "SIGKILL");
  const killedAt = await cursorOf(db);
  log(`killed the projector (SIGKILL to its process group) at cursor ${killedAt}; ledger at ${w.maxOffset}`);
  await resolve(w);
  await settle(w);
  check((await cursorOf(db)) === killedAt, `the killed projector wrote nothing more (cursor still ${killedAt} while the ledger moved to ${w.maxOffset})`);
  child = spawnProjector(p.venue, logPath);
  log("restarted the projector");
  await waitCursor(db, w.maxOffset, "after the restart");
  await recount(db, s, p.venue, "before the stale refund (alice's C leg live)");
  await staleRefund(w);
  await waitCursor(db, w.maxOffset, "after the stale refund");

  console.log("\nrows:");
  await checkRows(w, db);

  await recount(db, s, p.venue, "final");

  if (REBUILD_URL) {
    console.log("\nrebuild (replay from offset 0 into a second database):");
    const rdb = postgres(REBUILD_URL, { max: 2, onnotice: () => undefined });
    const { SCHEMA_SQL } = await import("@owarine/db");
    await rdb.unsafe(SCHEMA_SQL);
    await indexWriter(rdb).truncate();
    const t0 = Date.now();
    const replay = startProjectorLoop({ db: rdb, ledger: s.c, baseUrl: URL_, auth: noAuth(), party: p.venue, log: (l) => log(`rebuild: ${l}`) });
    await replay.waitFor(w.maxOffset, 90_000);
    await replay.stop();
    log(`rebuild caught up in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const [live, rebuilt] = [await dump(db), await dump(rdb)];
    for (const t of Object.keys(live)) check(JSON.stringify(live[t]) === JSON.stringify(rebuilt[t]), `${t}: rebuild equals live (${live[t]!.length} rows)`);
    await rdb.end();
  }

  killGroup(child, "SIGTERM");
  await db.end();
  console.log(`\n${failures.length === 0 ? "PASS" : `FAIL (${failures.length})`}: projector scenario, last offset ${w.maxOffset}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();
