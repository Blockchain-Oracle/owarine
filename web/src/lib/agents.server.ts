import "server-only";
import { getDb, seatHolderLeases } from "@owarine/db";
import type { CreatorLabels } from "@owarine/markets/server";

/**
 * The seat addresses of leased parties (C8f): a strategy's creator is a party on the ledger, and the screens know a
 * seat by its base58 address, so a creator who holds a lease is shown (and recognised as "you") by that address. A
 * party with no live lease stays a party. Read-only, from the seat pool the lease routes own, through the shared seat
 * key resolution (`@owarine/db`, C4c). Each label carries its lease's start offset (C8i): a strategy an earlier visitor
 * of the same recycled party published is never labelled as the current lessee's, so it is not "yours" on the screens
 * and the playbook route refuses its notes. `caller` relabels the calling seat's own party with the key that proved
 * itself (a device joined by a seat link finds its own listings), from ITS lease's start, never from offset 0.
 */
export async function leasedAddresses(caller?: { party: string; address: string; fromOffset: number } | null): Promise<CreatorLabels> {
  const db = getDb();
  const labels = new Map<string, { address: string; fromOffset: number }>();
  if (db) {
    try {
      for (const [party, label] of await seatHolderLeases(db)) labels.set(party, label);
    } catch {
      // unreadable: every creator stays a party
    }
  }
  if (caller) labels.set(caller.party, { address: caller.address, fromOffset: caller.fromOffset });
  return labels;
}

/**
 * The web server's own registry reader (C8f): `@owarine/markets/strategies`' `listStrategies`/`getStrategy`, called by a
 * route handler, read the ledger through the seat tier (as the venue, read-only) instead of calling our own route
 * over HTTP. Installed once per process; a deployment without the seat tier keeps the route-backed default.
 */
let installed = false;
export async function ensureStrategyReader(): Promise<void> {
  if (installed) return;
  const [{ seatServer }, { installStrategyReader }, { ok, err }, { diagnosis }] = await Promise.all([
    import("./ledger.server"),
    import("@owarine/markets/strategies"),
    import("@owarine/core/schemas"),
    import("@owarine/core/types"),
  ]);
  const state = seatServer();
  if (!state.ok) return;
  const server = state.server;
  installStrategyReader({
    async listStrategies() {
      try {
        return ok(await server.agents.strategies(await leasedAddresses()), Date.now());
      } catch (error) {
        // The ledger's own text names parties and contracts: it stays in the server log (C4d M4).
        console.error(`[agents] registry unreadable: ${error instanceof Error ? error.message : String(error)}`);
        return err(diagnosis("rpc-down", "registry unreadable"));
      }
    },
  });
  installed = true;
}
