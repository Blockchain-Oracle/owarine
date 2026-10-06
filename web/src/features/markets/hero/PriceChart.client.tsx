"use client";

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { HERO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { drawnOf, isOneTickMore, NOTHING_DRAWN, syncReferenceLine, type DrawnSeries } from "./chart-sync";
import type { ChartPoint } from "./useChartSeries";
import { ORACLE_SCALE, PRICE_DISPLAY_DP } from "./units";

interface PriceChartClientProps {
  points: ChartPoint[];
  /** The oracle's print; null while pending — no line is drawn at a guessed level. */
  openingRaw: bigint | null;
  /** The reference line's axis title; the opening print by default, "prev close" on the closed hero (S18a). */
  lineLabel?: string;
  className?: string;
}

interface Built {
  chart: IChartApi;
  series: ISeriesApi<"Line">;
  priceLine: IPriceLine | null;
  drawn: DrawnSeries;
}

/** Floats exist only here, at the canvas boundary. */
const toValue = (raw: bigint): number => Number(raw) / 10 ** ORACLE_SCALE;
/** The axis and last-value labels read in cents, as the reference's cents-scale oracle drew them. */
const MIN_MOVE = 1 / 10 ** PRICE_DISPLAY_DP;

/**
 * Theme comes from the token surfaces at mount, never from literals in this file.
 *
 * Read off the chart's own container, not the document root: `/reels` is a dark island
 * that keeps its black card in light mode, so it scopes surface-appropriate ink on
 * `.reel-card`. Reading from the root would hand that card the page's near-black ink
 * and draw an invisible line on it.
 */
function cssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || "currentColor";
}

/** The canvas needs a resolved family list: `--font-data` is a `var()` chain the canvas cannot read, so it fell back to serif. */
function resolvedFont(el: HTMLElement): string {
  const probe = document.createElement("span");
  probe.style.fontFamily = "var(--font-data)";
  el.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family || "ui-monospace, monospace";
}

function buildChart(container: HTMLDivElement): Built {
  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: cssVar(container, "--color-ink-muted"),
      fontFamily: resolvedFont(container),
      attributionLogo: false,
    },
    grid: { vertLines: { visible: false }, horzLines: { color: cssVar(container, "--color-hairline") } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    crosshair: { mode: CrosshairMode.Hidden },
    handleScroll: false,
    handleScale: false,
  });
  const series = chart.addSeries(LineSeries, {
    color: cssVar(container, "--color-ink"),
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: true,
    priceFormat: { type: "price", precision: PRICE_DISPLAY_DP, minMove: MIN_MOVE },
  });
  return { chart, series, priceLine: null, drawn: NOTHING_DRAWN };
}

export function PriceChartClient({ points, openingRaw, lineLabel, className }: PriceChartClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const builtRef = useRef<Built | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const built = buildChart(containerRef.current);
    builtRef.current = built;
    return () => {
      built.chart.remove();
      builtRef.current = null;
    };
  }, []);

  useEffect(() => {
    const built = builtRef.current;
    if (!built) return;
    const data = points.map((p) => ({ time: p.timeSec as UTCTimestamp, value: toValue(p.valueRaw) }));
    const last = data.at(-1);
    // Append only a live tick of the series already drawn; another market's points replace it whole.
    if (last && isOneTickMore(built.drawn, data)) {
      built.series.update(last);
    } else {
      built.series.setData(data);
      built.chart.timeScale().fitContent();
    }
    built.drawn = drawnOf(data);
  }, [points]);

  useEffect(() => {
    const built = builtRef.current;
    const container = containerRef.current;
    if (!built || !container) return;
    // The chart stays mounted when the selection moves to another Window, so the line follows the print it is given.
    built.priceLine = syncReferenceLine(built.series, built.priceLine, openingRaw === null ? null : toValue(openingRaw), lineLabel ?? HERO.openingPrint, (price, title) =>
      built.series.createPriceLine({
        price,
        color: cssVar(container, "--color-ink-secondary"),
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title,
      }),
    );
  }, [openingRaw, lineLabel]);

  return <div ref={containerRef} className={cn("h-56 w-full", className)} />;
}
