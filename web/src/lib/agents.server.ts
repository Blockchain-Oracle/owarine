import "server-only";
import { getDb } from "@agari/db";

/**
 * The seat addresses of leased parties (C8f): a strategy's creator is a party on the ledger, and the screens know a
 * seat by its base58 address, so a creator who holds a lease is shown (and recognised as "you") by that address. A
 * party with no live lease stays a party. Read-only, from the seat pool the lease routes own.
 */
export async function leasedAddresses(): Promise<Map<string, string>> {
  const db = getDb();
  if (!db) return new Map();
  try {
    const rows = await db<{ party: string; address: string | null }[]>`SELECT party, address FROM seat_pool WHERE state = 'leased' AND address IS NOT NULL`;
    return new Map(rows.filter((r) => r.address).map((r) => [r.party, r.address as string]));
  } catch {
    return new Map();
  }
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
        return err(diagnosis("rpc-down", `registry unreadable: ${error instanceof Error ? error.message : String(error)}`));
      }
    },
  });
  installed = true;
}
