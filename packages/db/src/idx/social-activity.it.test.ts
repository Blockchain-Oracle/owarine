/**
 * The push drain's seat inbox (C11, plan iOS step 10) against a real Postgres: a seat's own calls and verdicts, private
 * ones included, by the address its lease was taken with; published-only feeds are untouched. Skipped unless
 * PROJECTOR_IT=1 and DATABASE_URL name a scratch database; it truncates the projection tables.
 *
 *   PROJECTOR_IT=1 DATABASE_URL=postgres://localhost/pm_c11_test pnpm vitest run packages/db/src/idx/social-activity.it.test.ts
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../client";
import { ensureSchema } from "../migrate";
import { socialActivityReader } from "./social-activity";
import { indexWriter } from "./write";

const RUN = process.env.PROJECTOR_IT === "1" && Boolean(process.env.DATABASE_URL);
const T = 1_790_694_000;
const SEAT = "7hXq3sKd9Vw2mPfL4cRt8nYb6ZjE1aUo5GkT2iWxQeNa";

describe.skipIf(!RUN)("seat inbox: a seat's own calls, private ones included", () => {
  const db = getDb()!;
  beforeEach(async () => {
    await ensureSchema();
    await indexWriter(db).truncate();
    await db`INSERT INTO idx_markets (market, market_key, terms_cid, series_key, market_index, cash_unit, trading_start_sec, lock_at_sec, expiry_sec,
      open_deadline_sec, close_deadline_sec, refund_after_sec, policy_version, quorum, oracles, max_deviation_bps, resolver, opened_update_id,
      opened_offset, opened_ts_sec, symbol, cadence_sec, state, winner, resolved_ts_sec)
      VALUES ('m1', 'k1', 't1', 's1', 1, 10000, ${T}, ${T + 50}, ${T + 60}, ${T + 70}, ${T + 90}, ${T + 600}, 2, 2, '[]', 50, 'resolver::1220', 'u0', 1, ${T},
      'TSLA', 60, 'resolved', 0, ${T + 75})`;
    await db`INSERT INTO idx_fills (update_id, node_id, ledger_offset, market, terms_cid, quote_cid, leg_cid, pair_id, owner_party, owner_address, venue_party,
      side, kind, path, price_ticks, side_ticks, lots, fee, cash_unit, ts_sec)
      VALUES ('u1', 3, 2, 'm1', 't1', 'q1', 'l1', 'p1', 'seat-1::1220', ${SEAT}, 'venue::1220', 0, 0, 2, 620, 620, 100, 10, 10000, ${T + 10})`;
    await db`INSERT INTO idx_legs (leg_cid, market, terms_cid, owner_party, owner_address, is_venue, pair_id, outcome, lots, cash_unit, backing_share, fee_paid,
      refund_after_sec, origin, created_update_id, created_offset, created_ts_sec, status, result, payout_base, closed_update_id, closed_offset, closed_ts_sec)
      VALUES ('l1', 'm1', 't1', 'seat-1::1220', ${SEAT}, false, 'p1', 0, 100, 10000, 620000000, 10, ${T + 600}, 'accept', 'u1', 2, ${T + 10},
      'settled', 'won', 1000000000, 'u2', 3, ${T + 80})`;
  });
  afterAll(async () => {
    await db.end();
  });

  it("reads the seat's unpublished fill and its settled leg by the lease address, and nothing for another address", async () => {
    const r = socialActivityReader(db);
    const fills = await r.seatFills(SEAT, { sinceSec: T });
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({ signature: "u1", market: "m1", wallet: SEAT, kind: 0, symbol: "TSLA", lots: "100", amount_base: "620000000" });
    const settled = await r.seatSettlements(SEAT, { sinceSec: T });
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ market: "m1", owner: SEAT, state: "resolved", winner: 0, held_yes_lots: "100", held_no_lots: "0", redeemed: true, redeemed_by_crank: true, payout_base: "1000000000", last_signature: "u2" });
    expect(await r.seatFills("someone-else")).toEqual([]);
    // Unpublished: the public inbox still shows nothing (privacy-thesis §5).
    expect(await r.walletFills([SEAT])).toEqual([]);
  });
});
