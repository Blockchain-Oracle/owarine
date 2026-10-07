"use client";

import type { EventMarket } from "@owarine/core/types";
import { useOpeningPrice } from "@owarine/markets/react";
import { ReadingBoundary } from "@/components/states";
import { MarketWindowChart } from "../chart/MarketWindowChart";
import { useChartSeries } from "../hero/useChartSeries";

/**
 * The drawer's live chart — the reference's first block (`Ticket624Drawer.tsx` L851–855: `lg:hidden`, a
 * 128px canvas in a rounded box, drawn only once there is a series to draw). On the rail the hero chart
 * beside the ticket does this job, so the Ticket mounts this as a drawer only; the series is the hero's
 * own subscription, read once more.
 */
export function TicketMiniChart({ market }: { market: EventMarket }) {
  const series = useChartSeries(market);
  const opening = useOpeningPrice(market.marketId);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  if (series?.ok && series.value.points.length < 2) return null;
  return (
    <div className="tk-mini-chart">
      <div className="tk-mini-chart-canvas">
        <ReadingBoundary reading={series} shape="chart">
          {(chart) => <MarketWindowChart market={market} openingRaw={openingRaw} backfill={chart.points} variant="compact" />}
        </ReadingBoundary>
      </div>
    </div>
  );
}
