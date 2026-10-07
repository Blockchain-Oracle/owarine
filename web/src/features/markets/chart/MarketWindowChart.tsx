"use client";

import { spotSymbolOf } from "@owarine/core/market";
import type { EventMarket } from "@owarine/core/types";
import { useMemo } from "react";
import { HERO } from "@/lib/copy";
import type { ChartPoint } from "../hero/useChartSeries";
import { WindowChart } from "./WindowChart";

export interface MarketWindowChartProps {
  market: EventMarket;
  /** The opening print on the print scale; null while it is pending. */
  openingRaw: bigint | null;
  /** The Window's recorded prints (`useChartSeries`), drawn wherever the live series has not started. */
  backfill?: readonly ChartPoint[];
  variant?: "full" | "compact";
  className?: string;
}

/**
 * A Window on the chart: its open and close, its opening print, and the live line of the spot it settles on (a
 * 24/7 stock Window follows its xStock, the price it settles on, not the stock's own print).
 */
export function MarketWindowChart({ market, openingRaw, backfill, variant = "full", className }: MarketWindowChartProps) {
  const times = useMemo(() => ({ openMs: market.tradingStartSec * 1000, closeMs: market.expirySec * 1000 }), [market.tradingStartSec, market.expirySec]);
  return (
    <WindowChart
      asset={market.asset}
      symbol={spotSymbolOf(market.asset, market.lane)}
      times={times}
      referenceRaw={openingRaw}
      referenceLabel={HERO.openingPrint}
      backfill={backfill}
      variant={variant}
      className={className}
      label={`${market.asset} price chart for this Window`}
    />
  );
}
