/**
 * C13a: a recycled seat never shows the previous visitor's history. Alice leased a seat party first and traded; the
 * party was drained and freed, then Bob leased it. Every seat read the web serves (`/api/index/wallet/<address>/*`)
 * goes through the lease, so Bob sees his own fills, exits, positions, quotes and receipts and none of Alice's.
 *
 * Runs against a real Postgres in its own namespace (skipped unless SEAT_PG_URL names a scratch database):
 *
 *   SEAT_PG_URL=postgres://localhost/pm_c13a pnpm vitest run packages/db/src/idx/read-lease.test.ts
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "../schema";
import { indexReader, type IdxSeatLease } from "./read";
import { publishedFills, publishedReceipts } from "./read-published";
import { seatActivityReader } from "./seat-activity";
import { crowdFlow } from "./social-activity";

const URL_ = process.env.SEAT_PG_URL;
const NS = "c13a_lease_test";
const PARTY = "agari-user-seat-1::1220aa";
const VENUE = "agari-venue::1220bb";
const ALICE = "AliceSeatAddress1111111111111111111111111111";
const BOB = "BobSeatAddress22222222222222222222222222222222";
const T = 1_790_000_000;
/** Alice's lease began at offset 1, Bob's at 100 (after Alice's legs all ended and the party was freed). */
const BOB_LEASE: IdxSeatLease = { party: PARTY, fromOffset: 100 };

describe.skipIf(!URL_)("seat history over a recycled seat party (Postgres)", () => {
  const admin = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined });
  const sql = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined, connection: { search_path: NS } });
  const reader = indexReader(sql);
  const inbox = seatActivityReader(sql);

  const market = (id: string, index: number) => sql`
    INSERT INTO idx_markets (market, market_key, terms_cid, series_key, symbol, cadence_sec, market_index, cash_unit, trading_start_sec, lock_at_sec,
      expiry_sec, open_deadline_sec, close_deadline_sec, refund_after_sec, policy_version, quorum, oracles, max_deviation_bps, resolver,
      opened_update_id, opened_offset, opened_ts_sec, state)
    VALUES (${id}, ${`BTC-60-${index}`}, ${`terms-${id}`}, 'BTC-60', 'BTC', 60, ${index}, 1000, ${T}, ${T + 50}, ${T + 60}, ${T}, ${T + 120}, ${T + 3600},
      1, 2, '[]'::jsonb, 100, ${VENUE}, ${`open-${id}`}, ${index}, ${T}, 'resolved')`;
  const fill = (update: string, id: string, offset: number) => sql`
    INSERT INTO idx_fills (update_id, node_id, ledger_offset, market, terms_cid, quote_cid, leg_cid, pair_id, owner_party, venue_party, side, kind, path,
      price_ticks, side_ticks, lots, fee, cash_unit, ts_sec)
    VALUES (${update}, 0, ${offset}, ${id}, ${`terms-${id}`}, ${`q-${update}`}, ${`leg-${update}`}, ${`pair-${update}`}, ${PARTY}, ${VENUE}, 0, 0, 2,
      600, 600, 2, 0, 1000, ${T + offset})`;
  const leg = (update: string, id: string, created: number, closed: number) => sql`
    INSERT INTO idx_legs (leg_cid, market, terms_cid, owner_party, is_venue, pair_id, outcome, lots, cash_unit, backing_share, fee_paid, refund_after_sec,
      origin, created_update_id, created_offset, created_ts_sec, status, result, payout_base, closed_update_id, closed_offset, closed_ts_sec)
    VALUES (${`leg-${update}`}, ${id}, ${`terms-${id}`}, ${PARTY}, false, ${`pair-${update}`}, 0, 2, 1000, 1200, 0, ${T + 3600}, 'accept', ${update},
      ${created}, ${T + created}, 'settled', 'won', 2000, ${`close-${update}`}, ${closed}, ${T + closed})`;
  const position = (id: string) => sql`
    INSERT INTO idx_positions (market, owner_party, yes_lots, bought_yes_lots, paid_ticklots, fills, redeemed, first_ts_sec, last_ts_sec)
    VALUES (${id}, ${PARTY}, 2, 2, 1200, 1, true, ${T}, ${T})`;
  const quote = (cid: string, id: string, offset: number) => sql`
    INSERT INTO idx_quotes (quote_cid, kind, market, terms_cid, user_party, pair_id, side, price_ticks, lots, cash_unit, valid_until_sec,
      issued_update_id, issued_offset, issued_ts_sec, status)
    VALUES (${cid}, 'quote', ${id}, ${`terms-${id}`}, ${PARTY}, ${`pair-${cid}`}, 0, 600, 2, 1000, ${T + 30}, ${`issue-${cid}`}, ${offset},
      ${T + offset}, 'accepted')`;
  const receipt = (cid: string, id: string, offset: number, pair = `pair-${cid}`) => sql`
    INSERT INTO idx_receipts (receipt_cid, owner_party, market, market_key, pair_id, outcome, resolved, lots, cash_unit, backing_share, cost, payout, fee,
      created_update_id, created_offset, created_ts_sec)
    VALUES (${cid}, ${PARTY}, ${id}, ${`key-${id}`}, ${pair}, 0, 0, 2, 1000, 1200, 1200, 2000, 0, ${`r-${cid}`}, ${offset}, ${T + offset})`;
  const publication = (cid: string, handle: string, id: string, pair: string, offset: number) => sql`
    INSERT INTO idx_publications (publication_cid, owner_party, handle, market, market_key, pair_id, outcome, lots, backing_share, created_update_id,
      created_offset, created_ts_sec)
    VALUES (${cid}, ${PARTY}, ${handle}, ${id}, ${`key-${id}`}, ${pair}, 0, 2, 1200, ${`p-${cid}`}, ${offset}, ${T + offset})`;

  beforeAll(async () => {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${NS} CASCADE; CREATE SCHEMA ${NS}`);
    await sql.unsafe(SCHEMA_SQL);
    for (const [id, index] of [["m-alice", 1], ["m-bob", 2], ["m-both", 3]] as const) await market(id, index);
    // Alice: m-alice and m-both, all ended before the party was freed.
    await fill("u-alice-1", "m-alice", 5);
    await fill("u-alice-2", "m-both", 6);
    await leg("u-alice-1", "m-alice", 5, 50);
    await quote("q-alice", "m-alice", 4);
    await receipt("r-alice", "m-alice", 50);
    // Bob: m-bob, and the same m-both Window after his lease began.
    await fill("u-bob-1", "m-bob", 110);
    await fill("u-bob-2", "m-both", 120);
    await leg("u-bob-1", "m-bob", 110, 130);
    await quote("q-bob", "m-bob", 109);
    await receipt("r-bob", "m-bob", 130);
    for (const id of ["m-alice", "m-bob", "m-both"]) await position(id);
    // Publications: Alice published her m-alice call; Bob published m-bob and kept m-both private.
    await publication("pub-alice", ALICE, "m-alice", "pair-u-alice-1", 7);
    await publication("pub-bob", BOB, "m-bob", "pair-u-bob-1", 111);
    await receipt("r-bob-pub", "m-bob", 131, "pair-u-bob-1");
    await receipt("r-bob-private", "m-both", 140, "pair-u-bob-2");
  }, 60_000);
  afterAll(async () => {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${NS} CASCADE`);
    await sql.end();
    await admin.end();
  }, 60_000);

  it("Bob's fills are his alone", async () => {
    const rows = await reader.walletFills(BOB, { lease: BOB_LEASE });
    expect(rows.map((r) => r.signature).sort()).toEqual(["u-bob-1", "u-bob-2"]);
  });

  it("Bob's exits, quotes and receipts are his alone", async () => {
    expect((await reader.walletActions(BOB, { lease: BOB_LEASE })).map((r) => r.signature)).toEqual(["close-u-bob-1"]);
    expect((await reader.orders({ owner: BOB, lease: BOB_LEASE })).map((r) => r.quote_cid)).toEqual(["q-bob"]);
    expect((await reader.walletReceipts(BOB, { lease: BOB_LEASE })).map((r) => r.receipt_cid)).toEqual(["r-bob-private", "r-bob-pub", "r-bob"]);
  });

  it("a position the previous visitor also traded is withheld, never merged into Bob's", async () => {
    expect((await reader.positions(BOB, { lease: BOB_LEASE })).map((r) => r.market)).toEqual(["m-bob"]);
  });

  it("an address with no lease reads nothing, so Alice cannot read the party after she left", async () => {
    expect(await reader.walletFills(ALICE, { lease: null })).toEqual([]);
    expect(await reader.walletActions(ALICE, {})).toEqual([]);
    expect(await reader.positions(ALICE, {})).toEqual([]);
    expect(await reader.orders({ owner: ALICE })).toEqual([]);
    expect(await reader.walletReceipts(ALICE, {})).toEqual([]);
  });

  it("anyone else reads only what a seat published, under its own handle", async () => {
    expect((await publishedFills(sql, BOB)).map((r) => r.signature)).toEqual(["u-bob-1"]);
    expect((await publishedFills(sql, BOB)).map((r) => r.taker)).toEqual([BOB]);
    expect((await publishedReceipts(sql, BOB)).map((r) => r.receipt_cid)).toEqual(["r-bob-pub"]);
    expect((await publishedFills(sql, ALICE)).map((r) => r.signature)).toEqual(["u-alice-1"]);
    expect(await publishedReceipts(sql, ALICE)).toEqual([]);
  });

  it("a retracted publication drops out", async () => {
    await sql`DELETE FROM idx_publications WHERE publication_cid = 'pub-bob'`;
    expect(await publishedFills(sql, BOB)).toEqual([]);
    expect(await publishedReceipts(sql, BOB)).toEqual([]);
  });

  it("Bob's own inbox is his fills and verdicts, published or not, and none of Alice's", async () => {
    expect((await inbox.fills(BOB, BOB_LEASE)).map((r) => [r.signature, r.wallet])).toEqual([["u-bob-2", BOB], ["u-bob-1", BOB]]);
    const verdicts = await inbox.settlements(BOB, BOB_LEASE);
    expect(verdicts.map((r) => [r.market, r.owner, r.held_yes_lots, r.payout_base])).toEqual([["m-bob", BOB, "2", "2000"]]);
  });

  it("crowd flow counts publications only, and says nothing below 5 distinct publishers", async () => {
    // Earlier tests left one publisher (Alice's call under the shared party); the flow is withheld.
    expect(await crowdFlow(sql, T)).toBeNull();
    for (const n of [2, 3, 4]) {
      await sql`INSERT INTO idx_publications (publication_cid, owner_party, handle, market, market_key, pair_id, outcome, lots, backing_share,
        created_update_id, created_offset, created_ts_sec) VALUES (${`crowd-${n}`}, ${`seat-${n}::1220`}, ${`h${n}`}, 'm-bob', 'key-m-bob', ${`pc-${n}`}, 1, 3, 1200, ${`c${n}`}, ${200 + n}, ${T + 200})`;
    }
    expect(await crowdFlow(sql, T)).toBeNull();
    await sql`INSERT INTO idx_publications (publication_cid, owner_party, handle, market, market_key, pair_id, outcome, lots, backing_share,
      created_update_id, created_offset, created_ts_sec) VALUES ('crowd-5', 'seat-5::1220', 'h5', 'm-bob', 'key-m-bob', 'pc-5', 0, 1, 1200, 'c5', 205, ${T + 200})`;
    expect(await crowdFlow(sql, T)).toEqual({ fills: 5, up_lots: "3", down_lots: "9" });
  });
});
