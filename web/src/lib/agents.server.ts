import "server-only";
import { getDb, seatHolders } from "@agari/db";

/**
 * The seat addresses of leased parties (C8f): a strategy's creator is a party on the ledger, and the screens know a
 * seat by its base58 address, so a creator who holds a lease is shown (and recognised as "you") by that address. A
 * party with no live lease stays a party. Read-only, from the seat pool the lease routes own, through the shared seat
 * key resolution (`@agari/db` `seatHolders`, C4c). `caller` relabels the calling seat's own party with the key that
 * proved itself, so a device joined by a seat link (its own key) still finds its own listings as "yours".
 */
export async function leasedAddresses(caller?: { party: string; address: string } | null): Promise<Map<string, string>> {
  const db = getDb();
  if (!db) return caller ? new Map([[caller.party, caller.address]]) : new Map();
  let labels: Map<string, string>;
  try {
    labels = await seatHolders(db, { leasedOnly: true });
  } catch {
    labels = new Map();
  }
  if (caller) labels.set(caller.party, caller.address);
  return labels;
}

/**
 * The web server's own registry reader (C8f): `@agari/markets/strategies`' `listStrategies`/`getStrategy`, called by a
 * route handler, read the ledger through the seat tier (as the venue, read-only) instead of calling our own route
 * over HTTP. Installed once per process; a deployment without the seat tier keeps the route-backed default.
 */
let installed = false;
export async function ensureStrategyReader(): Promise<void> {
  if (installed) return;
  const [{ seatServer }, { installStrategyReader }, { ok, err }, { diagnosis }] = await Promise.all([
    import("./ledger.server"),
    import("@agari/markets/strategies"),
    import("@agari/core/schemas"),
    import("@agari/core/types"),
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
