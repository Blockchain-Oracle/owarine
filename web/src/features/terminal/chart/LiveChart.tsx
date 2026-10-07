"use client";

import { seriesSnapshot, subscribeSeries } from "@owarine/markets/runtime";
import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { approach, cssNumber, easeRange, formatPrice, lowerBound, niceTicks, priceDecimals, stepDecimals, targetRange, timeWindow, winning, xOf, yOf, type Plot, type View } from "./engine";

/** What the price pill carries beside the price while a position is open; written by the parent, read every frame. */
export interface ChartPnl {
  text: string;
  positive: boolean;
}

export interface LiveChartProps {
  /** The spot symbol the line follows (a Window's `ladderSpotSymbol`). */
  symbol: string;
  /** Visible time span, ms (default 90 s). */
  spanMs?: number;
  /** The Window's open print: the line Up and Down are decided against. */
  openPrice?: number | null;
  /** The Window's close (expiry), drawn as the 終値 line when it comes into view. */
  closeAtMs?: number | null;
  /** The spot when the position was opened. */
  entryPrice?: number | null;
  /** The open position's side; with `openPrice` it shades the profit band. */
  side?: "up" | "down" | null;
  pnl?: RefObject<ChartPnl | null>;
  className?: string;
  label?: string;
}

interface Theme {
  ink: string;
  muted: string;
  helper: string;
  hairline: string;
  up: string;
  down: string;
  black: string;
  white: string;
  /** Text on an ink or muted fill: white in light, black in dark. */
  inverse: string;
  upOnBlack: string;
  downOnBlack: string;
  pink: string;
  axisFont: string;
  tagFont: string;
  pillFont: string;
  line: number;
  padRight: number;
  padY: number;
}

function readTheme(el: Element): Theme {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    ink: v("--ow-ink"), muted: v("--ow-muted"), helper: v("--ow-helper"), hairline: v("--ow-hairline"), up: v("--ow-up-line"), down: v("--ow-down-line"),
    black: v("--ow-black"), white: v("--ow-white"), inverse: v("--ow-inverse"), upOnBlack: v("--ow-up-on-black"), downOnBlack: v("--ow-down-on-black"), pink: v("--ow-pink"),
    axisFont: v("--ow-chart-axis-font"), tagFont: v("--ow-chart-tag-font"), pillFont: v("--ow-chart-pill-font"),
    line: cssNumber(v("--ow-chart-line"), 2), padRight: cssNumber(v("--ow-chart-pad-right"), 84), padY: cssNumber(v("--ow-chart-pad-y"), 28),
  };
}

const HEAD_TAU_MS = 90;
const RANGE_TAU_MS = 280;
const PULSE_MS = 1_400;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Tradash's chart: the whole workspace is a live line. Two stacked canvases at device resolution (grid and labels
 * behind, redrawn only when the range moves; the line, band, tags and price pill in front, every frame), one
 * `requestAnimationFrame` loop that pauses off screen, no chart library and no React work per tick: the series lives in
 * the markets runtime (`subscribeSeries`), the PnL in a ref the parent writes.
 */
export function LiveChart({ symbol, spanMs = 90_000, openPrice = null, closeAtMs = null, entryPrice = null, side = null, pnl, className, label }: LiveChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ spanMs, openPrice, closeAtMs, entryPrice, side });
  props.current = { spanMs, openPrice, closeAtMs, entryPrice, side };

  useEffect(() => subscribeSeries(symbol, () => undefined), [symbol]);

  useEffect(() => {
    const box = boxRef.current;
    const back = backRef.current;
    const front = frontRef.current;
    if (!box || !back || !front) return;
    const bctx = back.getContext("2d");
    const fctx = front.getContext("2d");
    if (!bctx || !fctx) return;

    let theme = readTheme(box);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let backKey = "";
    let range: { lo: number; hi: number } | null = null;
    let head: number | null = null;
    let lastFrameMs = performance.now();
    let raf = 0;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const rect = box.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = rect.width;
      height = rect.height;
      for (const c of [back, front]) {
        c.width = Math.max(1, Math.round(width * dpr));
        c.height = Math.max(1, Math.round(height * dpr));
      }
      backKey = "";
    };

    const drawBack = (view: View, plot: Plot, price: number) => {
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, width, height);
      const ticks = niceTicks(view.lo, view.hi, Math.max(3, Math.round((plot.y1 - plot.y0) / 70)));
      const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 0;
      const decimals = stepDecimals(step, price);
      bctx.font = theme.axisFont;
      bctx.textBaseline = "middle";
      bctx.textAlign = "left";
      for (const v of ticks) {
        const y = Math.round(yOf(v, view, plot)) + 0.5;
        if (y < plot.y0 - 1 || y > plot.y1 + 1) continue;
        bctx.strokeStyle = theme.hairline;
        bctx.lineWidth = 1;
        bctx.beginPath();
        bctx.moveTo(plot.x0, y);
        bctx.lineTo(plot.x1, y);
        bctx.stroke();
        bctx.fillStyle = theme.helper;
        bctx.fillText(formatPrice(v, decimals), plot.x1 + 8, y);
      }
    };

    const frame = (nowPerf: number) => {
      raf = 0;
      const dt = nowPerf - lastFrameMs;
      lastFrameMs = nowPerf;
      const p = props.current;
      const series = seriesSnapshot(symbol);
      const n = series.p.length;
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.clearRect(0, 0, width, height);
      const plot: Plot = { x0: 0, x1: Math.max(10, width - theme.padRight), y0: theme.padY, y1: Math.max(theme.padY + 10, height - theme.padY) };

      if (n === 0) {
        fctx.font = theme.tagFont;
        fctx.fillStyle = theme.muted;
        fctx.textAlign = "center";
        fctx.textBaseline = "middle";
        fctx.fillText(series.seeded ? `Waiting for ${symbol}'s next trade…` : `Loading ${symbol}…`, width / 2, height / 2);
        if (backKey !== "empty") {
          bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          bctx.clearRect(0, 0, width, height);
          backKey = "empty";
        }
        schedule();
        return;
      }

      const nowMs = Date.now();
      const last = series.p[n - 1]!;
      const snap = reduced.matches;
      head = head === null || snap ? last : head + (last - head) * approach(dt, HEAD_TAU_MS);
      const tw = timeWindow(nowMs, p.spanMs);
      const target = targetRange({ t: series.t, p: series.p, t0: tw.t0, head, pinned: [p.openPrice, p.entryPrice] });
      range = snap ? target : easeRange(range, target, approach(dt, RANGE_TAU_MS));
      const view: View = { ...tw, lo: range.lo, hi: range.hi };

      const key = `${width}x${height}:${range.lo.toPrecision(9)}:${range.hi.toPrecision(9)}`;
      if (key !== backKey) {
        drawBack(view, plot, last);
        backKey = key;
      }

      const xHead = xOf(nowMs, view, plot);
      const yHead = yOf(head, view, plot);
      const pnlNow = pnl?.current ?? null;
      const win = pnlNow ? pnlNow.positive : winning(p.side, head, p.openPrice);
      const tone = win === null ? theme.ink : win ? theme.up : theme.down;

      // The open print: what Up and Down are decided against; the band between it and the head is the position's edge.
      if (typeof p.openPrice === "number") {
        const yOpen = yOf(p.openPrice, view, plot);
        if (p.side) {
          fctx.globalAlpha = 0.09;
          fctx.fillStyle = win ? theme.up : theme.down;
          fctx.fillRect(plot.x0, Math.min(yOpen, yHead), xHead - plot.x0, Math.abs(yHead - yOpen));
          fctx.globalAlpha = 1;
        }
        fctx.strokeStyle = theme.muted;
        fctx.lineWidth = 1;
        fctx.setLineDash([4, 4]);
        fctx.beginPath();
        fctx.moveTo(plot.x0, Math.round(yOpen) + 0.5);
        fctx.lineTo(plot.x1, Math.round(yOpen) + 0.5);
        fctx.stroke();
        fctx.setLineDash([]);
        drawTag(fctx, theme, `OPEN ${formatPrice(p.openPrice)}`, plot.x0 + 8, yOpen, theme.muted, theme.inverse);
      }

      // The Window's close, 終値, once it is on screen.
      if (typeof p.closeAtMs === "number" && p.closeAtMs >= view.t0 && p.closeAtMs <= view.t1) {
        const x = Math.round(xOf(p.closeAtMs, view, plot)) + 0.5;
        fctx.strokeStyle = theme.pink;
        fctx.lineWidth = 1;
        fctx.setLineDash([3, 3]);
        fctx.beginPath();
        fctx.moveTo(x, plot.y0 - theme.padY / 2);
        fctx.lineTo(x, plot.y1 + theme.padY / 2);
        fctx.stroke();
        fctx.setLineDash([]);
        drawTag(fctx, theme, "終値 CLOSE", x + 4, plot.y0 - theme.padY / 2 + 8, theme.pink, theme.white);
      }

      // The line: points from just before the left edge, then on to the tweened head at now.
      const i0 = Math.max(0, lowerBound(series.t, view.t0) - 1);
      fctx.beginPath();
      fctx.moveTo(xOf(series.t[i0]!, view, plot), yOf(series.p[i0]!, view, plot));
      for (let i = i0 + 1; i < n; i++) fctx.lineTo(xOf(series.t[i]!, view, plot), yOf(series.p[i]!, view, plot));
      fctx.lineTo(xHead, yHead);
      fctx.lineJoin = "round";
      fctx.lineCap = "round";
      fctx.strokeStyle = tone;
      fctx.lineWidth = theme.line;
      fctx.stroke();
      // A soft wash under the line.
      fctx.lineTo(xHead, plot.y1 + theme.padY);
      fctx.lineTo(xOf(series.t[i0]!, view, plot), plot.y1 + theme.padY);
      fctx.closePath();
      const wash = fctx.createLinearGradient(0, plot.y0, 0, plot.y1 + theme.padY);
      wash.addColorStop(0, tone);
      wash.addColorStop(1, "transparent");
      fctx.globalAlpha = 0.1;
      fctx.fillStyle = wash;
      fctx.fill();
      fctx.globalAlpha = 1;

      if (typeof p.entryPrice === "number") {
        const yEntry = yOf(p.entryPrice, view, plot);
        fctx.strokeStyle = theme.ink;
        fctx.lineWidth = 1;
        fctx.beginPath();
        fctx.moveTo(plot.x0, Math.round(yEntry) + 0.5);
        fctx.lineTo(xHead, Math.round(yEntry) + 0.5);
        fctx.stroke();
        drawTag(fctx, theme, "ENTRY", Math.max(plot.x0 + 8, xHead - 64), yEntry, theme.ink, theme.inverse);
      }

      // The head: a dot with a slow pulse, a leader to the price pill on the axis.
      if (!snap) {
        const phase = (nowPerf % PULSE_MS) / PULSE_MS;
        fctx.globalAlpha = 0.35 * (1 - phase);
        fctx.fillStyle = tone;
        fctx.beginPath();
        fctx.arc(xHead, yHead, 4 + 12 * phase, 0, Math.PI * 2);
        fctx.fill();
        fctx.globalAlpha = 1;
      }
      fctx.fillStyle = tone;
      fctx.beginPath();
      fctx.arc(xHead, yHead, 4, 0, Math.PI * 2);
      fctx.fill();
      fctx.strokeStyle = tone;
      fctx.lineWidth = 1;
      fctx.setLineDash([2, 3]);
      fctx.beginPath();
      fctx.moveTo(xHead + 6, Math.round(yHead) + 0.5);
      fctx.lineTo(plot.x1 + 2, Math.round(yHead) + 0.5);
      fctx.stroke();
      fctx.setLineDash([]);
      drawPill(fctx, theme, formatPrice(head, priceDecimals(head)), pnlNow, plot.x1 + 2, yHead, width - plot.x1 - 6);

      schedule();
    };

    const schedule = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      schedule();
    });
    ro.observe(box);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) {
        lastFrameMs = performance.now();
        schedule();
      }
    });
    io.observe(box);
    // A theme flip (data-theme on <html>) re-reads the tokens and redraws the grid.
    const mo = new MutationObserver(() => {
      theme = readTheme(box);
      backKey = "";
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [symbol, pnl]);

  return (
    <div ref={boxRef} role="img" aria-label={label ?? `${symbol} live price`} className={cn("ow-live-chart relative h-full w-full", className)}>
      <canvas ref={backRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <canvas ref={frontRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </div>
  );
}

/** A small rounded tag at (x, y-centre). */
function drawTag(ctx: CanvasRenderingContext2D, theme: Theme, text: string, x: number, y: number, fill: string, ink: string) {
  ctx.font = theme.tagFont;
  const w = ctx.measureText(text).width + 12;
  const h = 18;
  ctx.fillStyle = fill;
  roundRect(ctx, x, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 6, y + 0.5);
}

/** The black price pill on the axis; with a position, the PnL rides beneath it in green or red. */
function drawPill(ctx: CanvasRenderingContext2D, theme: Theme, price: string, pnl: ChartPnl | null, x: number, y: number, maxW: number) {
  ctx.font = theme.pillFont;
  const h = 24;
  const w = Math.min(maxW, Math.max(ctx.measureText(price).width, pnl ? ctx.measureText(pnl.text).width : 0) + 16);
  const rows = pnl ? 2 : 1;
  const top = y - h / 2;
  ctx.fillStyle = theme.black;
  roundRect(ctx, x, top, w, h * rows, 12);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.white;
  ctx.fillText(price, x + 8, y + 0.5);
  if (pnl) {
    ctx.fillStyle = pnl.positive ? theme.upOnBlack : theme.downOnBlack;
    ctx.fillText(pnl.text, x + 8, y + h + 0.5);
  }
}
