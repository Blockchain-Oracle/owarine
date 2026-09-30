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
 *
 * C4c (security review L2): a write the seat authorised before its release or expiry can land after one empty read.
 * So a seat is freed only when (a) no command it journalled is still in flight (`seat_commands` pending or unknown
 * before its deadline), and (b) two empty reads at least `settleMs` apart agree: the first stamps
 * `drain_empty_since_ms`, a later one frees, and any read that finds something clears the stamp. `work` sweeps on
 * every empty read, so cash a late write brought back is swept by the second.
 */
export type RecycleCheck = { free: true } | { free: false; why: string };
export type RecycleOutcome = { kind: "freed" } | { kind: "held"; why: string } | { kind: "busy" };

/** How long an empty seat stays empty before it is freed: two ops drain passes (15 s each) and some. */
export const RECYCLE_SETTLE_MS = 30_000;

/** The columns C9d adds to the web's `seat_pool` (applied by its schema; repeated here for a database ops set up alone). */
export const SEAT_RECYCLE_COLUMNS_SQL = `
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS draining_since_ms bigint;
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS drain_checked_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS drain_note text;
ALTER TABLE seat_pool ADD COLUMN IF NOT EXISTS drain_empty_since_ms bigint;
`;

export async function recycleDrainingSeat(
  db: Db,
  party: string,
  nowMs: number,
  work: () => Promise<RecycleCheck>,
  o: { settleMs?: number } = {},
): Promise<RecycleOutcome> {
  const settleMs = o.settleMs ?? RECYCLE_SETTLE_MS;
  return db.begin(async (tx) => {
    const [row] = await tx<{ party: string; drain_empty_since_ms: string | number | null }[]>`
      SELECT party, drain_empty_since_ms FROM seat_pool WHERE party = ${party} AND state = 'draining' FOR UPDATE SKIP LOCKED`;
    if (!row) return { kind: "busy" as const };
    const hold = async (why: string, emptySinceMs: number | null) => {
      await tx`UPDATE seat_pool SET drain_checked_ms = ${nowMs}, drain_note = ${why}, drain_empty_since_ms = ${emptySinceMs} WHERE party = ${party}`;
      return { kind: "held" as const, why };
    };
    const [flight] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM seat_commands WHERE party = ${party} AND state IN ('pending', 'unknown') AND deadline_ms > ${nowMs}`;
    if ((flight?.n ?? 0) > 0) return hold(`${flight!.n} write${flight!.n === 1 ? "" : "s"} still in flight`, null);
    let check: RecycleCheck;
    try {
      check = await work();
    } catch (error) {
      check = { free: false, why: `check failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 180)}` };
    }
    if (!check.free) return hold(check.why, null);
    const emptySince = row.drain_empty_since_ms === null ? null : Number(row.drain_empty_since_ms);
    if (emptySince === null || nowMs - emptySince < settleMs) {
      const since = emptySince ?? nowMs;
      return hold(`empty; freed if still empty in ${Math.ceil((since + settleMs - nowMs) / 1000)} s`, since);
    }
    await tx`UPDATE seat_pool SET state = 'free', lease_id = NULL, address = NULL, freed_at_ms = ${nowMs}, open_legs = 0, busy_until_ms = 0,
      next_settle_ms = 0, draining_since_ms = NULL, drain_checked_ms = ${nowMs}, drain_note = NULL, drain_empty_since_ms = NULL WHERE party = ${party}`;
    return { kind: "freed" as const };
  });
}
