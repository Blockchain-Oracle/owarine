/**
 * C2e (K-317): a seat's private calls live only in its private list. Since abu-pm-main 0.5.2 a private call's payout
 * lands in the private bucket, so the seat's history (fills, exits, receipts) leaves it out, while its public calls on
 * the same Window stay listed, and the private list (`privatePositions`) reads it with the bucket its receipt names.
 *
 * Runs against a real Postgres in its own namespace (skipped unless SEAT_PG_URL names a scratch database):
 *
 *   SEAT_PG_URL=postgres://localhost/pm_c2e pnpm vitest run packages/db/src/idx/read-private-history.test.ts
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "../schema";
import { indexReader, type IdxSeatLease } from "./read";
import { privatePositions } from "./read-private";

const URL_ = process.env.SEAT_PG_URL;
const NS = "c2e_private_history_test";
const PARTY = "pm-seat-1::1220aa";
const VENUE = "pm-venue::1220bb";
const ADDRESS = "CarolSeatAddress333333333333333333333333333333";
const T = 1_791_270_000;
const LEASE: IdxSeatLease = { party: PARTY, fromOffset: 1 };

describe.skipIf(!URL_)("private calls stay out of the seat's history (Postgres)", () => {
  const admin = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined });
  const sql = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined, connection: { search_path: NS } });
  const reader = indexReader(sql);

  const market = sql`
    INSERT INTO idx_markets (market, market_key, terms_cid, series_key, symbol, cadence_sec, market_index, cash_unit, trading_start_sec, lock_at_sec,
      expiry_sec, open_deadline_sec, close_deadline_sec, refund_after_sec, policy_version, quorum, oracles, max_deviation_bps, resolver,
      opened_update_id, opened_offset, opened_ts_sec, state)
    VALUES ('m-1', 'BTC-1m:5', 'terms-1', 'BTC-1m', 'BTC', 60, 5, 1000, ${T}, ${T + 50}, ${T + 60}, ${T}, ${T + 100}, ${T + 3600},
      1, 2, '[]'::jsonb, 100, ${VENUE}, 'open-1', 1, ${T}, 'resolved')`;
  const leg = (pair: string, offset: number, ref: string | null) => sql`
    INSERT INTO idx_legs (leg_cid, market, terms_cid, owner_party, is_venue, pair_id, outcome, lots, cash_unit, backing_share, fee_paid, refund_after_sec,
      origin, created_update_id, created_offset, created_ts_sec, status, result, payout_base, closed_update_id, closed_offset, closed_ts_sec, beneficiary_ref)
    VALUES (${`leg-${pair}`}, 'm-1', 'terms-1', ${PARTY}, false, ${pair}, 0, 2, 1000, 1200, 30, ${T + 3600}, 'accept', ${`u-${pair}`},
      ${offset}, ${T + offset}, 'settled', 'won', 2000, ${`close-${pair}`}, ${offset + 50}, ${T + offset + 50}, ${ref})`;
  const fill = (pair: string, offset: number) => sql`
    INSERT INTO idx_fills (update_id, node_id, ledger_offset, market, terms_cid, quote_cid, leg_cid, pair_id, owner_party, venue_party, side, kind, path,
      price_ticks, side_ticks, lots, fee, cash_unit, ts_sec)
    VALUES (${`u-${pair}`}, 0, ${offset}, 'm-1', 'terms-1', ${`q-${pair}`}, ${`leg-${pair}`}, ${pair}, ${PARTY}, ${VENUE}, 0, 0, 2, 600, 600, 2, 30, 1000, ${T + offset})`;
  const receipt = (pair: string, offset: number, paidInto: string | null) => sql`
    INSERT INTO idx_receipts (receipt_cid, owner_party, market, market_key, pair_id, outcome, resolved, lots, cash_unit, backing_share, cost, payout, fee,
      paid_into, created_update_id, created_offset, created_ts_sec)
    VALUES (${`r-${pair}`}, ${PARTY}, 'm-1', 'BTC-1m:5', ${pair}, 0, 0, 2, 1000, 1200, 1230, 2000, 30, ${paidInto}, ${`settle-${pair}`}, ${offset + 50}, ${T + offset + 50})`;

  beforeAll(async () => {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${NS} CASCADE; CREATE SCHEMA ${NS}`);
    await sql.unsafe(SCHEMA_SQL);
    await market;
    // A public call, a 0.5.2 private call (its receipt names the bucket) and a 0.5.1 private call (its receipt does not).
    await leg("pub", 10, null);
    await fill("pub", 10);
    await receipt("pub", 10, null);
    await leg("priv", 11, "private");
    await fill("priv", 11);
    await receipt("priv", 11, "private");
    await leg("old", 12, "private");
    await fill("old", 12);
    await receipt("old", 12, null);
  }, 60_000);
  afterAll(async () => {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${NS} CASCADE`);
    await sql.end();
    await admin.end();
  }, 60_000);

  it("the seat's fills, exits and receipts list only the public call", async () => {
    expect((await reader.walletFills(ADDRESS, { lease: LEASE })).map((r) => r.pair_id)).toEqual(["pub"]);
    expect((await reader.walletActions(ADDRESS, { lease: LEASE })).map((r) => r.signature)).toEqual(["close-pub"]);
    expect((await reader.walletReceipts(ADDRESS, { lease: LEASE })).map((r) => r.receipt_cid)).toEqual(["r-pub"]);
  });

  it("the private list reads both private calls, with the bucket the 0.5.2 receipt names", async () => {
    const rows = await privatePositions(sql, PARTY, LEASE.fromOffset);
    expect(rows.map((r) => [r.pair_id, r.paid_into, r.payout])).toEqual([
      ["old", null, "2000"],
      ["priv", "private", "2000"],
    ]);
  });
});
