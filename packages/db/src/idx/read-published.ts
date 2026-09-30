/**
 * Someone else's record, from what they chose to publish (plan §5, C13a). `/u/<address>` for anyone but the viewer
 * reads only opt-in `Publication`s under that seat address's handle: the fill that opened each published pair leg, and
 * the settlement receipt of each published call (a pair leg by its pair and side, a ticket by its product and figures,
 * as the board's `tapeTickets` matches it). A retracted publication drops out of both. Rows are the `FillRow` and
 * `ReceiptRow` shapes the seat's own history reads, so the same replay settles them.
 */
import type postgres from "postgres";
import { fillCols, type IdxRow } from "./read";

type Sql = postgres.Sql;

const LIMIT_MAX = 1_000;
const clamp = (limit: number | undefined, fallback = 200) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? fallback)));

/** The published trades of one handle, newest first; `taker` is the handle, so the replay attributes them to it. */
export async function publishedFills(sql: Sql, handle: string, q: { limit?: number; offset?: number } = {}): Promise<IdxRow[]> {
  return sql`
    SELECT ${fillCols(sql, sql`p.handle`)} FROM idx_publications p
      JOIN idx_fills f ON f.owner_party = p.owner_party AND f.pair_id = p.pair_id AND f.market = p.market AND f.kind IN (0, 2) AND p.product IS NULL
    WHERE p.handle = ${handle}
    ORDER BY f.ts_sec DESC, f.ledger_offset DESC, f.node_id DESC LIMIT ${clamp(q.limit)} OFFSET ${Math.max(0, Math.floor(q.offset ?? 0))}`;
}

/** The settled figures of one handle's published calls, newest first. */
export async function publishedReceipts(sql: Sql, handle: string, q: { limit?: number } = {}): Promise<IdxRow[]> {
  return sql`
    SELECT * FROM (
      SELECT DISTINCT ON (r.receipt_cid) r.receipt_cid, r.market, r.market_key, r.pair_id, r.outcome, r.resolved, r.lots::text, r.cash_unit::text,
        r.backing_share::text, r.cost::text, r.payout::text, r.fee::text, r.product, r.detail, r.created_update_id AS signature,
        r.created_offset::text AS seq, r.created_ts_sec::text AS ts_sec, m.symbol, m.cadence_sec, m.basis, m.expiry_sec::text, m.state, m.winner,
        m.void_reason, m.void_detail, m.resolved_ts_sec::text, m.event_question, m.event_answer, r.created_offset AS sort_offset
      FROM idx_publications p
        JOIN idx_receipts r ON r.owner_party = p.owner_party AND r.market_key = p.market_key AND r.pair_id = p.pair_id AND r.outcome = p.outcome
          AND ((p.product IS NULL AND r.product IS NULL)
            OR (r.product = p.product AND r.lots = p.lots AND r.backing_share = p.backing_share))
        LEFT JOIN idx_markets m ON m.market = r.market
      WHERE p.handle = ${handle} AND NOT r.dismissed
      ORDER BY r.receipt_cid
    ) published ORDER BY sort_offset DESC LIMIT ${clamp(q.limit)}`;
}
