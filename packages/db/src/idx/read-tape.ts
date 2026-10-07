/**
 * The venue-wide tape (proof-analytics.md §1, lane 5b): three paged scans the leaderboard and traction read. On Canton
 * these are publication-only (privacy-thesis.md §5): `tape/fills` lists opt-in `Publication`s joined to their fill,
 * `tape/markets` carries market aggregates only above the k = 5 floor, and `tape/actions` is empty (no complete sets).
 * Each orders on a total key, so offset paging under a fixed upper bound never skips or repeats a row.
 */
import type postgres from "postgres";
import { fillCols, marketCols, type IdxRow } from "./read";

type Sql = postgres.Sql;

const LIMIT_MAX = 1_000;
const clamp = (limit: number | undefined) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? LIMIT_MAX)));
const skip = (offset: number | undefined) => Math.max(0, Math.floor(offset ?? 0));

export interface TapeMarketsQuery {
  /** Window start, unix seconds: Windows expiring at or after it, or resolving inside `[fromSec, toSec)`. */
  fromSec: number;
  toSec: number;
  /** Only Windows whose trading started at or after this second (their whole tape is in hand). */
  lookbackSec: number;
  /** Only Windows somebody published a trade in: a week's or a month's board would otherwise page every empty Window. */
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface TapeRangeQuery {
  /** `[sinceSec, untilSec)` on the fill's ledger effective time. */
  sinceSec: number;
  untilSec: number;
  limit?: number;
  offset?: number;
}

/** Windows in a board's scope with their Series grid; `MarketRow` shape without prints. */
export async function tapeMarkets(sql: Sql, q: TapeMarketsQuery): Promise<IdxRow[]> {
  return sql`
    SELECT ${marketCols(sql)}, NULL AS prints
    FROM idx_markets m LEFT JOIN idx_series s ON s.series = m.series
    WHERE m.expiry_sec >= ${q.lookbackSec} AND m.trading_start_sec >= ${q.lookbackSec}
      AND (m.expiry_sec >= ${q.fromSec} OR (m.resolved_ts_sec >= ${q.fromSec} AND m.resolved_ts_sec < ${q.toSec}))
      AND (${!q.publishedOnly} OR EXISTS (SELECT 1 FROM idx_publications p WHERE p.market = m.market))
    ORDER BY m.expiry_sec, m.market LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}

/**
 * Every published trade in a time range, oldest first: the fill that opened a published leg, identified by the seat
 * address the web bound or else the publication's handle. A retracted publication is gone from this read.
 */
export async function tapeFills(sql: Sql, q: TapeRangeQuery): Promise<IdxRow[]> {
  return sql`
    SELECT ${fillCols(sql, sql`COALESCE(p.owner_address, p.handle)`)}, p.handle
    FROM idx_publications p
      JOIN idx_fills f ON f.owner_party = p.owner_party AND f.pair_id = p.pair_id AND f.market = p.market AND f.kind IN (0, 2) AND p.product IS NULL
    WHERE f.ts_sec >= ${q.sinceSec} AND f.ts_sec < ${q.untilSec}
    ORDER BY f.ts_sec, f.ledger_offset, f.node_id, p.publication_cid LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}

/**
 * Published ticket results (0.4.0, the board's product branch): each opt-in `Publication` with a `product`, joined to
 * the `SettlementReceipt` it was published from (same owner, market, pair, side, product, lots and backing), with that
 * receipt's settled figures. Only a settled ticket has a receipt, so every row is a closed call. Oldest first.
 */
export async function tapeTickets(sql: Sql, q: TapeRangeQuery): Promise<IdxRow[]> {
  return sql`
    SELECT DISTINCT ON (p.publication_cid) COALESCE(p.owner_address, p.handle) AS wallet, p.handle, p.publication_cid, r.receipt_cid, r.market, r.market_key,
      r.pair_id, r.outcome, r.resolved, r.lots::text, r.cash_unit::text, r.backing_share::text, r.cost::text, r.payout::text, r.fee::text, r.product,
      r.detail, r.created_update_id AS signature, r.created_offset::text AS seq, r.created_ts_sec::text AS ts_sec, m.symbol, m.cadence_sec, m.basis,
      m.expiry_sec::text, m.state, m.winner, m.void_reason, m.void_detail, m.resolved_ts_sec::text, m.event_question, m.event_answer
    FROM idx_publications p
      JOIN idx_receipts r ON r.owner_party = p.owner_party AND r.market_key = p.market_key AND r.pair_id = p.pair_id AND r.product = p.product
        AND r.outcome = p.outcome AND r.lots = p.lots AND r.backing_share = p.backing_share
      LEFT JOIN idx_markets m ON m.market = r.market
    WHERE p.product IS NOT NULL AND r.created_ts_sec >= ${q.sinceSec} AND r.created_ts_sec < ${q.untilSec}
    ORDER BY p.publication_cid, r.created_offset LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}

/** Complete-set mints and merges: none exist on Canton (a pair is minted inside the accept), so the scan is empty. */
export async function tapeActions(_sql: Sql, _q: TapeRangeQuery): Promise<IdxRow[]> {
  return [];
}
