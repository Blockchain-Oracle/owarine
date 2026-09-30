import type { Db } from "./client";

/**
 * Which party a seat key acts as (C4c; plan §3 "Trust boundary", iOS step 2b): the ONE address → party resolution,
 * shared by ops (agents session, duel seats, desk discovery) and the web (the seat store's `byAddress`, the agents
 * registry labels). Nobody reads `seat_pool.address` for this on their own any more.
 *
 * A key maps to a party only while it belongs to that party's LIVE lease:
 *   - it holds the lease (`seat_pool.address`, state `leased`), or
 *   - it joined that same lease through a seat link (`seat_linked_keys.lease_id` = the pool row's current `lease_id`).
 *
 * Nothing else maps. A lease id is never reused, so when a lease ends (released, idle-expired, drained, freed, or the
 * party re-leased to someone else) every key of it stops mapping at once, with nothing to clean up; a joined key that
 * reset itself is deleted from `seat_linked_keys`. A recycled seat's next lease has a new id, so an old device never
 * maps to its next visitor, and a key joined to seat A can never resolve to seat B.
 *
 * The web creates `seat_linked_keys` with the pool (`SEAT_SCHEMA_SQL`); a database whose pool predates the seat link
 * (no such table yet) resolves lease holders only.
 */

type Row = Record<string, unknown>;

const UNDEFINED_TABLE = "42P01";
const missingTable = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === UNDEFINED_TABLE;

/**
 * The `seat_pool` row of the live lease this key holds or joined (the key's own lease first), whole, or null. The web's
 * seat store maps it to its `LeaseRow`; everyone else wants only its party (`seatPartyFor`).
 */
export async function seatLeaseRowFor(db: Db, address: string): Promise<Row | null> {
  try {
    const [row] = await db<Row[]>`
      SELECT p.* FROM seat_pool p
      WHERE p.state = 'leased' AND p.lease_id IS NOT NULL
        AND (p.address = ${address} OR p.lease_id = (SELECT k.lease_id FROM seat_linked_keys k WHERE k.address = ${address}))
      ORDER BY (p.address = ${address}) DESC
      LIMIT 1`;
    return row ?? null;
  } catch (error) {
    if (!missingTable(error)) throw error;
    const [row] = await db<Row[]>`SELECT p.* FROM seat_pool p WHERE p.state = 'leased' AND p.lease_id IS NOT NULL AND p.address = ${address} LIMIT 1`;
    return row ?? null;
  }
}

/** The party this key acts as right now (its own live lease, or the live lease it joined), or null. */
export async function seatPartyFor(db: Db, address: string): Promise<string | null> {
  const row = await seatLeaseRowFor(db, address);
  return row ? String(row.party) : null;
}

/**
 * The seat address each party is known by on screens: the key that took its lease (a joined key is a second way in,
 * never the seat's name). `leasedOnly` keeps live leases only; without it a draining seat still shows its last holder,
 * so a match or a listing it made is not relabelled while it drains. `parties` narrows the read.
 */
export async function seatHolders(db: Db, o: { parties?: readonly string[]; leasedOnly?: boolean } = {}): Promise<Map<string, string>> {
  const parties = o.parties ? [...new Set(o.parties)] : null;
  if (parties && parties.length === 0) return new Map();
  const rows = await db<{ party: string; address: string | null }[]>`
    SELECT party, address FROM seat_pool
    WHERE address IS NOT NULL
      ${o.leasedOnly ? db`AND state = 'leased'` : db``}
      ${parties ? db`AND party = ANY(${parties as string[]})` : db``}`;
  return new Map(rows.filter((r) => r.address).map((r) => [r.party, r.address as string]));
}

/**
 * `seatHolders` for live leases, with each lease's start offset (C8i): the address a creator party is shown by, and
 * the ledger offset from which its strategies are that lessee's. A strategy created before the offset is an earlier
 * visitor's on the same recycled party, and is never labelled (or writable) as the current lessee's.
 */
export async function seatHolderLeases(db: Db, o: { parties?: readonly string[] } = {}): Promise<Map<string, { address: string; fromOffset: number }>> {
  const parties = o.parties ? [...new Set(o.parties)] : null;
  if (parties && parties.length === 0) return new Map();
  const rows = await db<{ party: string; address: string | null; start_offset: string | number | null }[]>`
    SELECT party, address, start_offset FROM seat_pool
    WHERE address IS NOT NULL AND state = 'leased' AND start_offset IS NOT NULL
      ${parties ? db`AND party = ANY(${parties as string[]})` : db``}`;
  return new Map(rows.filter((r) => r.address).map((r) => [r.party, { address: r.address as string, fromOffset: Number(r.start_offset) }]));
}
