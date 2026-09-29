import { getDb } from "./client";
import { ensureSchema } from "./migrate";

/**
 * Closed season pools (`season_closures`, schema-games.ts). `Season_WithdrawRemainder` archives the pool, so the
 * ledger's active set no longer holds it; ops writes this row once the withdrawal is accepted, and the arena desk reads
 * it when a named season has no live pool. Money travels as decimal strings, as everywhere in the games store.
 */
export interface SeasonClosure {
  seasonId: string;
  endsAtSec: number;
  depositedBase: bigint;
  withdrawnBase: bigint;
  updateId: string;
}

/** Records a closure; a replay of the same season keeps the first row. False when no database is configured. */
export async function recordSeasonClosure(c: SeasonClosure): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO season_closures (season_id, ends_at_sec, deposited_base, withdrawn_base, update_id)
    VALUES (${c.seasonId}, ${c.endsAtSec}, ${c.depositedBase.toString()}, ${c.withdrawnBase.toString()}, ${c.updateId})
    ON CONFLICT (season_id) DO NOTHING
  `;
  return true;
}

/** The closure of one season, the newest when none is named; null when none is recorded or no database is configured. */
export async function readSeasonClosure(seasonId?: string): Promise<SeasonClosure | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = seasonId
    ? await db<Row[]>`SELECT season_id, ends_at_sec::text, deposited_base, withdrawn_base, update_id FROM season_closures WHERE season_id = ${seasonId}`
    : await db<Row[]>`SELECT season_id, ends_at_sec::text, deposited_base, withdrawn_base, update_id FROM season_closures ORDER BY ends_at_sec DESC LIMIT 1`;
  const r = rows[0];
  return r ? { seasonId: r.season_id, endsAtSec: Number(r.ends_at_sec), depositedBase: BigInt(r.deposited_base), withdrawnBase: BigInt(r.withdrawn_base), updateId: r.update_id } : null;
}

interface Row {
  season_id: string;
  ends_at_sec: string;
  deposited_base: string;
  withdrawn_base: string;
  update_id: string;
}
