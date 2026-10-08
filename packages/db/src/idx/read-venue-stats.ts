/**
 * Market-level stats from the venue's view (plan §5: "market-level stats may use the venue view above k = 5
 * participants"). Window counts are market facts and always shown; trading figures are summed only over Windows with at
 * least `K_ANON_FLOOR` participants, and how many Windows were held back is said, never hidden.
 */
import type postgres from "postgres";
import { K_ANON_FLOOR } from "../schema-index";

type Sql = postgres.Sql;

export interface VenueStatsRow {
  windows: number;
  resolved: number;
  voided: number;
  /** Windows with trading at or above the floor, whose figures are included. */
  public_windows: number;
  /** Windows with at least one participant but fewer than the floor: traded, figures withheld. */
  withheld_windows: number;
  trades: string;
  volume_lots: string;
  /** Users' stakes in venue cash base units (lots × ticks × cash unit). */
  volume_base: string;
  fees_base: string;
  payouts_base: string;
}

/** Windows whose close fell in `[sinceSec, untilSec]`: one voided early (a missed opening print) counts once its close has passed. */
export async function venueStats(sql: Sql, sinceSec: number, untilSec: number): Promise<VenueStatsRow> {
  const k = K_ANON_FLOOR;
  const [row] = await sql<VenueStatsRow[]>`
    SELECT count(*)::int AS windows,
      (count(*) FILTER (WHERE state = 'resolved'))::int AS resolved,
      (count(*) FILTER (WHERE state = 'voided'))::int AS voided,
      (count(*) FILTER (WHERE participants >= ${k}))::int AS public_windows,
      (count(*) FILTER (WHERE participants > 0 AND participants < ${k}))::int AS withheld_windows,
      COALESCE(sum(trade_count) FILTER (WHERE participants >= ${k}), 0)::text AS trades,
      COALESCE(sum(volume_lots) FILTER (WHERE participants >= ${k}), 0)::text AS volume_lots,
      COALESCE(sum(volume_ticklots * cash_unit) FILTER (WHERE participants >= ${k}), 0)::text AS volume_base,
      COALESCE(sum(fees_recognized_base) FILTER (WHERE participants >= ${k}), 0)::text AS fees_base,
      COALESCE(sum(payouts_base) FILTER (WHERE participants >= ${k}), 0)::text AS payouts_base
    FROM idx_markets WHERE expiry_sec >= ${sinceSec} AND expiry_sec <= ${untilSec}`;
  return row!;
}
