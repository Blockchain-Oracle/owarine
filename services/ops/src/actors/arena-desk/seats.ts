/**
 * Seats and parties, for the duel: the ledger names parties, the room and every screen name seat addresses (the seat
 * key the browser or phone holds). The web's seat pool (`seat_pool`, the same Postgres) is the one record of which
 * address leases which party; this reads it, read-only, through the shared resolution (`@owarine/db` `seatPartyFor` and
 * `seatHolders`, C4c), and remembers every pairing it has seen for the life of the process, so a match that outlives
 * its seat's lease still shows the players who played it.
 *
 * `partyOf` answers the LIVE lease only: the key that took it, or a key joined to it by a seat link. A key whose lease
 * ended maps to nothing, whatever this process remembers, so a recycled seat never acts for an old device (the open
 * and the season payout act on this answer). The pairing it proved is pinned for display: a match a joined phone
 * queued for shows that phone's key as the player, which is the key its room connection presents.
 *
 * With no database (a bare local run) nothing maps and every party reads as its derived address-shaped id
 * (`partyAddress`), which is stable and never a real seat's address, so nothing on a screen is wrong about who is who.
 */
import type { Address } from "@owarine/core/types";
import { seatHolders, seatPartyFor, type Db } from "@owarine/db";
import { partyAddress } from "@owarine/markets/ops/games";

export interface SeatDirectory {
  /** The seat address a party is known by, or its derived id. Synchronous: call `learn` first for fresh parties. */
  addressOf(party: string): Address;
  /** Reads the pool for any of these parties not yet known. */
  learn(parties: readonly string[]): Promise<void>;
  /** The party an address acts as right now (its own live lease, or the live lease it joined), or null. */
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
        for (const [party, address] of await seatHolders(db, { parties: unknown })) byParty.set(party, address as Address);
      } catch (error) {
        failed(error);
      }
    },
    async partyOf(address) {
      // Only a bare run (no pool at all) answers from memory: its pairings were pinned by a drive or a test.
      if (!db) return [...byParty].find(([, a]) => a === address)?.[0] ?? null;
      try {
        const party = await seatPartyFor(db, address);
        if (party) byParty.set(party, address as Address);
        return party;
      } catch (error) {
        failed(error);
        return null;
      }
    },
  };
}
