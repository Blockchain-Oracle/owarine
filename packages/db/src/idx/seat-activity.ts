/**
 * A seat's OWN inbox (C13a): its fills and the verdicts of its Windows, read from the projection under the visitor's
 * lease, published or not. `socialActivityReader` reads opt-in publications only, which is right for anyone else and
 * wrong for the seat itself: a seat that never published would never hear that its Window settled. The web serves
 * these rows only to the seat that proves itself (cookie or signed read header) and passes its lease, so a recycled
 * seat never shows the previous visitor's activity. Row shapes are `SocialFillRow` / `SocialSettlementRow`, so the
 * feed maps them unchanged; `wallet` / `owner` is the visitor's address.
 */
import type postgres from "postgres";
import type { IdxSeatLease } from "./read";
import type { SocialActivityQuery, SocialFillRow, SocialSettlementRow } from "./social-activity";

type Sql = postgres.Sql;

const LIMIT_MAX = 200;
const clamp = (limit: number | undefined, fallback = 50) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? fallback)));

/** Leg states that were no longer held when trading stopped: sold back, closed out or merged before the Window ended. */
const EXITED = ["sold", "closed_out", "merged"];

export function seatActivityReader(sql: Sql) {
  return {
    /**
     * Every fill of the leased party since its lease began, newest first. A fill of a resting call (0.5.1) reads as the
     * maker's seat, which the feed maps to "your resting call filled" (D-088); a firm-quote accept is the taker's.
     */
    async fills(address: string, lease: IdxSeatLease, q: SocialActivityQuery = {}): Promise<SocialFillRow[]> {
      return sql<SocialFillRow[]>`
        SELECT f.update_id AS signature, 0 AS outer_ix, f.node_id AS inner_ix, 0 AS fill_ix, f.market, ${address}::text AS wallet, f.kind,
          (CASE WHEN f.resting THEN 'maker' ELSE 'taker' END) AS seat, m.symbol, m.cadence_sec, f.lots::text AS lots, (f.side_ticks * f.lots * f.cash_unit)::text AS amount_base, f.ts_sec::text AS ts_sec
        FROM idx_fills f JOIN idx_markets m ON m.market = f.market
        WHERE f.owner_party = ${lease.party} AND f.ledger_offset >= ${lease.fromOffset} AND m.symbol IS NOT NULL
          ${q.sinceSec === undefined ? sql`` : sql`AND f.ts_sec >= ${q.sinceSec}`}
        ORDER BY f.ts_sec DESC, f.ledger_offset DESC LIMIT ${clamp(q.limit)}`;
    },

    /** One row per terminal Window the leased party held legs on since its lease began, newest settlement first. */
    async settlements(address: string, lease: IdxSeatLease, q: SocialActivityQuery = {}): Promise<SocialSettlementRow[]> {
      return sql<SocialSettlementRow[]>`
        SELECT l.market, ${address}::text AS owner, m.symbol, m.cadence_sec, m.state, m.winner, m.resolved_ts_sec::text, m.expiry_sec::text,
          sum(CASE WHEN l.outcome = 0 THEN l.lots ELSE 0 END)::text AS held_yes_lots, sum(CASE WHEN l.outcome = 1 THEN l.lots ELSE 0 END)::text AS held_no_lots,
          (m.cash_unit * 1000)::text AS lot_base, sum(l.backing_share + l.fee_paid)::text AS cost_base, '0' AS proceeds_base,
          bool_and(l.status <> 'open') AS redeemed, bool_and(l.status = 'settled') AS redeemed_by_crank, sum(COALESCE(l.payout_base, 0))::text AS payout_base,
          max(l.closed_update_id) AS last_signature, max(l.closed_ts_sec)::text AS last_ts_sec
        FROM idx_legs l JOIN idx_markets m ON m.market = l.market
        WHERE l.owner_party = ${lease.party} AND l.created_offset >= ${lease.fromOffset} AND NOT l.is_venue AND l.status <> ALL(${EXITED}::text[])
          AND m.state <> 'open' AND m.symbol IS NOT NULL ${q.sinceSec === undefined ? sql`` : sql`AND m.resolved_ts_sec >= ${q.sinceSec}`}
        GROUP BY l.market, m.symbol, m.cadence_sec, m.state, m.winner, m.resolved_ts_sec, m.expiry_sec, m.cash_unit
        ORDER BY m.resolved_ts_sec DESC NULLS LAST LIMIT ${clamp(q.limit)}`;
    },
  };
}

export type SeatActivityReader = ReturnType<typeof seatActivityReader>;
