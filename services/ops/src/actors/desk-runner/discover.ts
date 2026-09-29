/**
 * Which desks this runner looks after: every row in the database on this cluster, plus every `DeskMandate` on the
 * ledger that names the operator party and the database has not seen (opened from the studio while ops was down, or
 * after a database reset). A discovered desk gets a row keyed by its owner's seat address (the lease table maps the
 * party back; a mandate whose seat is not leased is left for the web's Go live step) and no mandate; it is checked,
 * valued and recorded, and trades only once the owner's signed mandate arrives through the web.
 */
import { getDb, type DeskRow } from "@agari/db";
import { listDesksByOperator } from "@agari/markets/desk/server";
import { errorText } from "../../runtime/env";
import type { RunnerContext } from "./types";

const DISCOVER_EVERY_SEC = 10 * 60;
let discoveredAtSec = 0;

/** The desks to run this pass, discovery included every ten minutes when the runner has a key to be found by. */
export async function discoverDesks(ctx: RunnerContext, nowSec: number): Promise<{ desks: DeskRow[]; found: number }> {
  let found = 0;
  if (ctx.rpc && ctx.operator && nowSec - discoveredAtSec >= DISCOVER_EVERY_SEC) {
    try {
      const known = await ctx.q.listDesks({ cluster: ctx.env.cluster });
      for (const d of await listDesksByOperator(ctx.rpc, ctx.operator.address)) {
        if (known.some((k) => k.address === (d.address as string))) continue;
        const owner = await seatAddressOf(d.owner as string);
        if (!owner) continue;
        await ctx.q.registerLiveDesk({ owner, cluster: ctx.env.cluster, address: d.address, operator: ctx.operator.address, mode: d.mode === "practice" ? "ask_first" : d.mode, nowSec });
        found += 1;
        ctx.log(`discovered desk ${d.address} of ${d.owner} (${d.mode}, seq ${d.seq})`);
      }
      discoveredAtSec = nowSec;
    } catch (error) {
      ctx.log(`discovery failed: ${errorText(error)}`);
    }
  }
  const desks = (await ctx.q.listDesks({ cluster: ctx.env.cluster })).filter((d) => d.state !== "closed");
  return { desks, found };
}

/** The seat address a party is leased to (the web's lease table in the same database), or null. */
async function seatAddressOf(party: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = (await db`SELECT address FROM seat_pool WHERE party = ${party} AND state = 'leased'`) as unknown as { address: string | null }[];
    return rows[0]?.address ?? null;
  } catch {
    return null;
  }
}
