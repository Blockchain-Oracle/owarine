import { getDb, type Db } from "@agari/db";

/**
 * The party a desk row's owner leases RIGHT NOW (C4d, K-210), from the web's lease table in the same database: the key
 * that holds a live lease, or one joined to a live lease by a seat link. Null when the owner holds no lease (released,
 * idle-expired, drained or recycled to someone else), and null without a database. A desk is traded and read only
 * through this: a row whose owner no longer leases the mandate's party is not that owner's desk any more.
 *
 * The same resolution as the web's seat store `byAddress`; C4c moves both onto `@agari/db`'s one helper.
 */
const UNDEFINED_TABLE = "42P01";

export async function leasePartyOf(address: string, db: Db | null = getDb()): Promise<string | null> {
  if (!db) return null;
  try {
    const rows = await db<{ party: string }[]>`
      SELECT party FROM seat_pool
      WHERE state = 'leased' AND lease_id IS NOT NULL
        AND (address = ${address} OR lease_id = (SELECT lease_id FROM seat_linked_keys WHERE address = ${address}))
      ORDER BY (address = ${address}) DESC LIMIT 1`;
    return rows[0]?.party ?? null;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== UNDEFINED_TABLE) throw error;
    const rows = await db<{ party: string }[]>`SELECT party FROM seat_pool WHERE state = 'leased' AND lease_id IS NOT NULL AND address = ${address} LIMIT 1`;
    return rows[0]?.party ?? null;
  }
}
