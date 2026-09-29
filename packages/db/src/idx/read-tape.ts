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
      JOIN idx_fills f ON f.owner_party = p.owner_party AND f.pair_id = p.pair_id AND f.market = p.market AND f.kind IN (0, 2)
    WHERE f.ts_sec >= ${q.sinceSec} AND f.ts_sec < ${q.untilSec}
    ORDER BY f.ts_sec, f.ledger_offset, f.node_id, p.publication_cid LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}

/** Complete-set mints and merges: none exist on Canton (a pair is minted inside the accept), so the scan is empty. */
export async function tapeActions(_sql: Sql, _q: TapeRangeQuery): Promise<IdxRow[]> {
  return [];
}
