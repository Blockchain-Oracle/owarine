/**
 * A seat's private calls (L-39, C8d), from the projection: its legs tagged `beneficiaryRef = private` created under this
 * lease, each with its Window and, once the venue settled it, the receipt that says what it paid. Engine 0.5.2 (K-315)
 * pays a private call straight back into the private bucket, and its receipt says so (`paid_into = 'private'`): it is
 * home at settlement. A 0.5.1 receipt (`paid_into` null) paid the seat's public balance, and its `dismissed` is the
 * cash-out: dismissing it is the same transaction that moves the payout back into the private bucket.
 * Read for the seat's own lease only (the caller passes the lease's party and start offset).
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export interface PrivatePositionRow {
  pair_id: string;
  market_key: string;
  symbol: string | null;
  cadence_sec: number | null;
  expiry_sec: string;
  outcome: number;
  lots: string;
  backing_share: string;
  fee_paid: string;
  status: string;
  result: string | null;
  payout: string | null;
  dismissed: boolean | null;
  receipt_cid: string | null;
  /** 0.5.2: `private` when the payout landed in the private bucket at settlement; null for a 0.5.1 receipt. */
  paid_into: string | null;
  /** What the leg's close paid its owner (a stale refund leaves no receipt: 0.5.2 refunds a private call into the private bucket). */
  leg_paid: string | null;
  created_update_id: string;
  created_ts_sec: string;
}

export async function privatePositions(sql: Sql, party: string, fromOffset: number, limit = 50): Promise<PrivatePositionRow[]> {
  return sql<PrivatePositionRow[]>`
    SELECT l.pair_id, m.market_key, m.symbol, m.cadence_sec, m.expiry_sec::text, l.outcome, l.lots::text, l.backing_share::text, l.fee_paid::text,
      l.status, l.result, r.payout::text AS payout, r.dismissed, r.receipt_cid, r.paid_into, l.payout_base::text AS leg_paid, l.created_update_id, l.created_ts_sec::text
    FROM idx_legs l
      JOIN idx_markets m ON m.market = l.market
      LEFT JOIN idx_receipts r ON r.owner_party = l.owner_party AND r.pair_id = l.pair_id AND r.product IS NULL
    WHERE l.owner_party = ${party} AND l.beneficiary_ref = 'private' AND l.created_offset >= ${fromOffset}
    ORDER BY l.created_offset DESC LIMIT ${Math.max(1, Math.min(200, limit))}`;
}
