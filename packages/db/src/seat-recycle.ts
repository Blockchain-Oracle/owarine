import type { Db } from "./client";

/**
 * Recycling one `draining` seat (plan §4 "Seats", C9d), shared by ops' seat drain (every pass, the primary path) and
 * the web's lease fallback. The seat's `seat_pool` row is claimed `FOR UPDATE SKIP LOCKED` for the whole check, so the
 * two recyclers never work one seat at once, and the row cannot be leased again until its cash sweep is done: a new
 * lessee's demo credit can never be swept by a recycler still holding an old read.
 *
 * `work` reads the seat as its party and, when it holds nothing, withdraws its cash; it answers whether the seat may be
 * freed. A held or failed check stamps `drain_checked_ms` and `drain_note`, so the next check starts with the seat
 * checked longest ago and `/status` can say what a draining seat is waiting on.
 */
export type RecycleCheck = { free: true } | { free: false; why: string };
export type RecycleOutcome = { kind: "freed" } | { kind: "held"; why: string } | { kind: "busy" };

/** The columns C9d adds to the web's `seat_pool` (applied by its schema; repeated here for a database ops set up alone). */
export const SEAT_RECYCLE_COLUMNS_SQL = `
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS draining_since_ms bigint;
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS drain_checked_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS drain_note text;
`;

export async function recycleDrainingSeat(db: Db, party: string, nowMs: number, work: () => Promise<RecycleCheck>): Promise<RecycleOutcome> {
  return db.begin(async (tx) => {
    const [row] = await tx`SELECT party FROM seat_pool WHERE party = ${party} AND state = 'draining' FOR UPDATE SKIP LOCKED`;
    if (!row) return { kind: "busy" as const };
    let check: RecycleCheck;
    try {
      check = await work();
    } catch (error) {
      check = { free: false, why: `check failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 180)}` };
    }
    if (!check.free) {
      await tx`UPDATE seat_pool SET drain_checked_ms = ${nowMs}, drain_note = ${check.why} WHERE party = ${party}`;
      return { kind: "held" as const, why: check.why };
    }
    await tx`UPDATE seat_pool SET state = 'free', lease_id = NULL, address = NULL, freed_at_ms = ${nowMs}, open_legs = 0, busy_until_ms = 0,
      next_settle_ms = 0, draining_since_ms = NULL, drain_checked_ms = ${nowMs}, drain_note = NULL WHERE party = ${party}`;
    return { kind: "freed" as const };
  });
}
