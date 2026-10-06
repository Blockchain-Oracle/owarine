import type postgres from "postgres";

type Sql = postgres.Sql;

/**
 * The venue mode's audit log (C-DAML-02): every change ops accepts on its admin route, appended, never updated, so the
 * mode survives a restart and anyone reading the projection can see who paused the venue, when and why. The ledger
 * twin (a venue-signed `VenueMode` contract) waits for a later DAR release (K-264); until then this log is the record.
 */
export const VENUE_MODE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS venue_mode_log (
  id          BIGSERIAL PRIMARY KEY,
  mode        TEXT     NOT NULL CHECK (mode IN ('open', 'reduce-only', 'paused')),
  reason      TEXT,
  set_by      TEXT     NOT NULL,
  set_at_sec  BIGINT   NOT NULL
);
`;

export interface VenueModeRow {
  mode: "open" | "reduce-only" | "paused";
  reason: string | null;
  setBy: string;
  setAtSec: number;
}

/** The latest accepted mode, or null when none was ever set (the venue is open). */
export async function latestVenueMode(sql: Sql): Promise<VenueModeRow | null> {
  const rows = await sql<{ mode: VenueModeRow["mode"]; reason: string | null; set_by: string; set_at_sec: string }[]>`
    SELECT mode, reason, set_by, set_at_sec::text FROM venue_mode_log ORDER BY id DESC LIMIT 1`;
  const r = rows[0];
  return r ? { mode: r.mode, reason: r.reason, setBy: r.set_by, setAtSec: Number(r.set_at_sec) } : null;
}

export async function recordVenueMode(sql: Sql, row: VenueModeRow): Promise<void> {
  await sql`INSERT INTO venue_mode_log (mode, reason, set_by, set_at_sec) VALUES (${row.mode}, ${row.reason}, ${row.setBy}, ${row.setAtSec})`;
}
