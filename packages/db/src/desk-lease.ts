import type { Db } from "./client";

/**
 * A draining seat's desks leave the index with it (C4d, K-210). Ops' seat drain closes the party's `DeskMandate` on the
 * ledger; this closes the index rows of the lease that is draining, so the desk runner never picks a closed desk back
 * up and no row of this visitor can later be read or traded against the next visitor's desk on the recycled party.
 *
 * A row is the lease's when its owner is the key that held the lease or a key joined to it (`seat_linked_keys`), both
 * read from the `seat_pool` row while it is still `draining` (the recycle clears them only when the seat is freed), or
 * when its desk address is the party's pre-C4d address (`legacyAddress`), which every lessee of the party shared. Each
 * row closed gets a `state_set` event naming why. A database without the desk tables (or the pool) closes nothing.
 */
export async function closeLeaseDesks(db: Db, i: { party: string; legacyAddress: string | null; reason: string; nowSec: number }): Promise<number> {
  const owners = async (): Promise<string[]> => {
    try {
      const rows = await db<{ address: string }[]>`
        SELECT address FROM seat_pool WHERE party = ${i.party} AND address IS NOT NULL
        UNION SELECT k.address FROM seat_linked_keys k JOIN seat_pool p ON p.lease_id = k.lease_id WHERE p.party = ${i.party}`;
      return rows.map((r) => r.address);
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code !== "42P01") throw error;
      const rows = await db<{ address: string }[]>`SELECT address FROM seat_pool WHERE party = ${i.party} AND address IS NOT NULL`;
      return rows.map((r) => r.address);
    }
  };
  try {
    const who = await owners();
    if (who.length === 0 && !i.legacyAddress) return 0;
    return await db.begin(async (tx) => {
      const closed = await tx<{ id: string }[]>`
        UPDATE desks SET state = 'closed', state_reason = ${i.reason}, updated_at_sec = ${i.nowSec}
        WHERE state <> 'closed' AND (owner = ANY(${who}) OR (${i.legacyAddress}::text IS NOT NULL AND address = ${i.legacyAddress}))
        RETURNING id`;
      for (const row of closed) {
        await tx`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${row.id}::uuid, 'state_set', 'desk', ${tx.json({ state: "closed", reason: i.reason })}, ${i.nowSec})`;
      }
      return closed.length;
    });
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "42P01") return 0;
    throw error;
  }
}
