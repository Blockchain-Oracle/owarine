/**
 * `/status` reads that only exist on Canton (C5): the projector's cursor against the ledger end, each oracle's newest
 * print, and the two backlogs the venue's actors must keep empty (Windows past their close deadline with no
 * Resolution; resolved Windows whose legs are still open). Venue-level facts only; integers as decimal strings.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export interface CursorHeadRow {
  offset: string;
  updated_at_ms: string;
  record_time_ms: string | null;
}

export interface OracleFreshRow {
  oracle: string;
  last_boundary_sec: string | null;
  last_recorded_sec: string | null;
  /** Distinct boundaries posted in the last ten minutes. */
  recent_boundaries: number;
}

export interface BacklogRow {
  unresolved: number;
  oldest_unresolved_deadline_sec: string | null;
  unsettled: number;
  oldest_unsettled_resolved_sec: string | null;
}

export async function cursorHead(sql: Sql, stream: string): Promise<CursorHeadRow | null> {
  const [row] = await sql<CursorHeadRow[]>`SELECT ledger_offset::text AS offset, updated_at_ms::text, record_time_ms::text FROM idx_cursor WHERE stream = ${stream}`;
  return row ?? null;
}

/** Every oracle any Series lists, with its newest print; an oracle that never posted comes back with nulls. */
export async function oracleFreshness(sql: Sql, nowSec: number): Promise<OracleFreshRow[]> {
  return sql<OracleFreshRow[]>`
    WITH listed AS (SELECT DISTINCT jsonb_array_elements_text(oracles) AS oracle FROM idx_series)
    SELECT l.oracle, max(p.boundary_sec)::text AS last_boundary_sec, max(p.recorded_ts_sec)::text AS last_recorded_sec,
      (count(DISTINCT p.boundary_sec) FILTER (WHERE p.boundary_sec >= ${nowSec - 600}))::int AS recent_boundaries
    FROM listed l LEFT JOIN idx_prints p ON p.oracle = l.oracle
    GROUP BY l.oracle ORDER BY l.oracle`;
}

/**
 * Resolver backlog: Windows still open `graceSec` past their close deadline. Settler backlog: resolved or voided
 * Windows with users' legs still open `graceSec` after the Resolution and before their stale-refund time.
 */
export async function pipelineBacklog(sql: Sql, nowSec: number, graceSec: number): Promise<BacklogRow> {
  const [row] = await sql<BacklogRow[]>`
    SELECT
      (count(*) FILTER (WHERE state = 'open' AND close_deadline_sec + ${graceSec} < ${nowSec}))::int AS unresolved,
      (min(close_deadline_sec) FILTER (WHERE state = 'open' AND close_deadline_sec + ${graceSec} < ${nowSec}))::text AS oldest_unresolved_deadline_sec,
      (count(*) FILTER (WHERE state <> 'open' AND legs_open > 0 AND resolved_ts_sec + ${graceSec} < ${nowSec} AND refund_after_sec > ${nowSec}))::int AS unsettled,
      (min(resolved_ts_sec) FILTER (WHERE state <> 'open' AND legs_open > 0 AND resolved_ts_sec + ${graceSec} < ${nowSec} AND refund_after_sec > ${nowSec}))::text AS oldest_unsettled_resolved_sec
    FROM idx_markets`;
  return row!;
}
