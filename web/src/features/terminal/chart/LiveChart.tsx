"use client";

import { liveSpot, peekClient, subscribeSpot } from "@owarine/markets/runtime";
import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { CandleView } from "./candle-view";
import type { CandleInterval } from "./candles";
import { ChartEngine, type ChartOverlay, type ChartTheme, type FrameInfo } from "./chart-engine";
import type { ChartView } from "./chart-style";
import { DotGrid } from "./dot-grid";

export type { ChartLevel, ChartOverlay, FrameInfo } from "./chart-engine";

/** What the controls ask of the chart: whether the candle view is panned away, and to come back. */
export interface ChartHandle {
  offCentre(): boolean;
  recentre(): void;
}

export interface LiveChartProps {
  /** The spot symbol the line follows (a Window's `ladderSpotSymbol`). */
  symbol: string;
  /** The open position's overlay; written by the parent, read every frame (no re-render per tick). */
  overlay?: RefObject<ChartOverlay | null>;
  /** Every frame's head position and motion, for the reaction overlay. */
  onFrame?: RefObject<((info: FrameInfo | null) => void) | null>;
  /** Line (Tradash's default) or candles at `interval`. */
  view?: ChartView;
  interval?: CandleInterval;
  handle?: RefObject<ChartHandle | null>;
  className?: string;
  label?: string;
}

function readTheme(el: Element): { chart: ChartTheme; dots: string } {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    chart: {
      up: v("--ow-up-line"), down: v("--ow-down-line"), ink: v("--ow-ink"), inverse: v("--ow-inverse"), helper: v("--ow-helper"), onLine: v("--ow-black"), breakeven: v("--ow-breakeven"),
      axisFont: v("--ow-chart-axis-font"), pillFont: v("--ow-chart-pill-font"), pillPriceFont: v("--ow-chart-pill-price-font"), pillPnlFont: v("--ow-chart-pill-pnl-font"),
      tagFont: v("--ow-chart-tag-font"), tagStrongFont: v("--ow-chart-tag-strong-font"), markFont: v("--ow-chart-mark-font"),
    },
    dots: v("--ow-hairline"),
  };
}

/**
 * Tradash's chart on Owarine's tokens: a parallax dot field and the live line, each its own canvas at ≤2× device
 * resolution, one continuous animation loop. Every streamed tick goes straight to the engine; nothing here re-renders.
 */
export function LiveChart({ symbol, overlay, onFrame, view = "line", interval = "1m", handle, className, label }: LiveChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    const dotsCanvas = dotsRef.current;
    const lineCanvas = lineRef.current;
    if (!box || !dotsCanvas || !lineCanvas) return;
    let theme = readTheme(box);
    const engine = new ChartEngine(lineCanvas, theme.chart, symbol);
    const dots = new DotGrid(dotsCanvas, theme.dots);
    engineRef.current = engine;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const resize = () => {
      engine.resize();
      dots.resize();
    };
    const loop = (now: number) => {
      engine.setOverlay(overlay?.current ?? null);
      const info = engine.frame(now);
      dots.frame(info, reduced.matches);
      onFrame?.current?.(info);
      raf = requestAnimationFrame(loop);
    };
    resize();
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    const mo = new MutationObserver(() => {
      theme = readTheme(box);
      engine.setTheme(theme.chart);
      dots.setColour(theme.dots);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      engineRef.current = null;
    };
    // The engine lives for the component; a symbol change resets it below instead of rebuilding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    engine?.reset(symbol);
    const feed = () => {
      const tick = liveSpot(symbol);
      if (tick) engineRef.current?.setPrice(Number(tick.priceE8) / 1e8);
    };
    const off = subscribeSpot(symbol, feed);
    feed();
    return off;
  }, [symbol]);

  // The candle view: built per symbol and interval, gestures on the line canvas; line view drops it.
  useEffect(() => {
    const engine = engineRef.current;
    const canvas = lineRef.current;
    if (!engine || !canvas) return;
    if (view === "line") {
      engine.setView("line", null);
      if (handle) handle.current = { offCentre: () => false, recentre: () => undefined };
      return;
    }
    const base = peekClient()?.priceFeedUrl?.replace(/\/$/, "") ?? null;
    const candles = new CandleView(symbol, interval, base, () => haptic("tick"));
    const stop = candles.start();
    const detach = candles.attach(canvas, () => engine.geometry());
    engine.setView("candles", candles);
    if (handle) handle.current = { offCentre: () => candles.offCentre, recentre: () => candles.recentre() };
    return () => {
      stop();
      detach();
    };
  }, [view, interval, symbol, handle]);

  return (
    <div ref={boxRef} role="img" aria-label={label ?? `${symbol} live price`} className={cn("relative h-full w-full overflow-hidden", className)}>
      <canvas ref={dotsRef} className="absolute inset-0 block h-full w-full" aria-hidden />
      <canvas ref={lineRef} className={cn("absolute inset-0 block h-full w-full", view === "candles" && "touch-none")} aria-hidden />
    </div>
  );
}
