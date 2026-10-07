/**
 * A wallet's resting calls (D-088) from the index: `wallet/{addr}/resting` rows (0.5.1, K-235), joined to their Windows'
 * index rows and Series grids, projected by core `restingOrderView`. Live calls and the ones that ended (filled, swept
 * unfilled, cancelled) come together, newest placement first, so the portfolio can say how each ended. A row names its
 * Window, the Window row names its Series, and the Series facts are cached for the runtime's life.
 */
import { restingOrderView, sortRestingViews, type RestingOrderRow, type RestingOrderView } from "@owarine/core/projection";
import type { Reading } from "@owarine/core/schemas";
import type { Address, MarketId } from "@owarine/core/types";
import { readSeries, readVenueStatic } from "../runtime/accounts";
import { nowMs } from "./clock";
import { indexRows, sec, type MarketRow } from "./index-api";
import { withReading } from "./reading";
import { isListable } from "./rows";

/** More than a seat can rest (16 per Window) across the Windows listed at once, and a day's worth of ended calls. */
const RESTING_LIMIT = 200;

export async function listRestingOrders(wallet: Address): Promise<Reading<RestingOrderView[]>> {
  return withReading(`restingOrders:${wallet}`, async () => {
    const [rows, venue] = await Promise.all([indexRows<RestingOrderRow>(`wallet/${wallet}/resting`, { limit: RESTING_LIMIT }), readVenueStatic()]);
    const ids = [...new Set(rows.map((row) => row.market))];
    if (ids.length === 0) return [];
    const windows = new Map((await indexRows<MarketRow>("markets", { ids: ids.join(",") })).filter(isListable).map((row) => [row.market, row]));
    const now = nowMs();
    const views: RestingOrderView[] = [];
    for (const row of rows) {
      const w = windows.get(row.market);
      if (!w?.series) continue;
      const series = await readSeries(w.series as Address);
      views.push(
        restingOrderView(
          row,
          {
            marketId: w.market as MarketId,
            asset: w.symbol ?? "",
            intervalSec: w.cadence_sec ?? 0,
            tradingStartSec: sec(w.trading_start_sec),
            lockAtSec: sec(w.lock_at_sec),
            expirySec: sec(w.expiry_sec),
            decimals: venue.decimals,
            grid: { lotBase: series.lotBase, cashUnit: series.cashUnit },
          },
          now,
        ),
      );
    }
    return sortRestingViews(views);
  });
}
