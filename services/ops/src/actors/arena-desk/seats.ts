/**
 * Seats and parties, for the duel: the ledger names parties, the room and every screen name seat addresses (the seat
 * key the browser or phone holds). The web's seat pool (`seat_pool`, the same Postgres) is the one record of which
 * address leases which party; this reads it, read-only, and remembers every pairing it has seen for the life of the
 * process, so a match that outlives its seat's lease still shows the players who played it.
 *
 * With no database (a bare local run) nothing maps and every party reads as its derived address-shaped id
 * (`partyAddress`), which is stable and never a real seat's address, so nothing on a screen is wrong about who is who.
 */
import type { Address } from "@agari/core/types";
import type { Db } from "@agari/db";
import { partyAddress } from "@agari/markets/ops/games";

export interface SeatDirectory {
  /** The seat address a party is known by, or its derived id. Synchronous: call `learn` first for fresh parties. */
  addressOf(party: string): Address;
  /** Reads the pool for any of these parties not yet known. */
  learn(parties: readonly string[]): Promise<void>;
  /** The party an address leases right now, or null. */
  partyOf(address: string): Promise<string | null>;
  /** Pins a pairing the caller already proved (a drive, a test). */
  pin(party: string, address: Address): void;
}

export function createSeatDirectory(db: Db | null, log: (why: string) => void): SeatDirectory {
  const byParty = new Map<string, Address>();
  let warned = false;
  const failed = (error: unknown) => {
    if (warned) return;
    warned = true;
    log(`the seat pool is unreadable (${error instanceof Error ? error.message : String(error)}); players show as derived ids`);
  };

  return {
    addressOf: (party) => byParty.get(party) ?? partyAddress(party),
    pin: (party, address) => void byParty.set(party, address),
    async learn(parties) {
      const unknown = [...new Set(parties)].filter((p) => !byParty.has(p));
      if (!db || unknown.length === 0) return;
      try {
        const rows = await db<{ party: string; address: string }[]>`SELECT party, address FROM seat_pool WHERE party = ANY(${unknown}) AND address IS NOT NULL`;
        for (const r of rows) byParty.set(r.party, r.address as Address);
      } catch (error) {
        failed(error);
      }
    },
    async partyOf(address) {
      // The live lease first: a remembered pairing may be a seat since recycled to another address.
      const remembered = () => [...byParty].find(([, a]) => a === address)?.[0] ?? null;
      if (!db) return remembered();
      try {
        const rows = await db<{ party: string }[]>`SELECT party FROM seat_pool WHERE address = ${address} AND state = 'leased' LIMIT 1`;
        const party = rows[0]?.party ?? null;
        if (party) byParty.set(party, address as Address);
        return party ?? remembered();
      } catch (error) {
        failed(error);
        return remembered();
      }
    },
  };
}
