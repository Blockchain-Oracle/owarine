/**
 * The desk's value over time (S22): one point per snapshot the runner took, oldest first, for the desk page's chart
 * and each holding's sparkline. Reads `desk_snapshots_desk_idx`; money stays in decimal strings.
 */
import type { Db } from "./client";
import { ensureSchema } from "./migrate";
import type { SnapshotHolding } from "./desk";

/**
 * When the desk's current life began, as SQL: the last `went_live` event's second, or 0 for a practice desk. A live
 * desk's value, loss baseline and chart count from here, never from its practice paper (C8i).
 */
export const liveSinceSql = (db: Db, deskId: string) =>
  db`COALESCE((SELECT max(e.at_sec) FROM desk_events e WHERE e.desk_id = ${deskId}::uuid AND e.kind = 'went_live'), 0)`;


export interface SeriesPoint {
  atSec: number;
  totalE6: string;
  /** Each held name's token price at that snapshot, `symbol → priceE8`. */
  prices: Record<string, string>;
}

export function deskSeriesQueries(db: Db) {
  const ready = () => ensureSchema();
  return {
    /** The newest `limit` snapshots of the desk's current life (a live desk's start at going live, C8i), oldest first. */
    async snapshotSeries(deskId: string, limit = 720): Promise<SeriesPoint[]> {
      await ready();
      const rows = await db<{ taken_at_sec: string; total_e6: string; holdings: SnapshotHolding[] }[]>`
        SELECT taken_at_sec, total_e6, holdings FROM desk_snapshots WHERE desk_id = ${deskId}::uuid AND taken_at_sec >= ${liveSinceSql(db, deskId)}
        ORDER BY taken_at_sec DESC LIMIT ${limit}`;
      return rows.reverse().map((r) => ({
        atSec: Number(r.taken_at_sec),
        totalE6: r.total_e6,
        prices: Object.fromEntries((r.holdings ?? []).filter((h) => h.priceE8).map((h) => [h.symbol, h.priceE8])),
      }));
    },
  };
}
