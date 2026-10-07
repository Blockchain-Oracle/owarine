/**
 * The live chart, to Tradash's renderer (context/13-revamp/tradash/SPEC-chart.md §§2–3), drawn with Owarine's tokens.
 *
 * Each animation frame: ease the price toward the latest tick and push it into the 600-sample ring (fixed 60 Hz sample
 * clock), centre the y-axis on the eased price at ±7.5 frozen steps, then draw in Tradash's order — grid, PnL band,
 * glow + line, left fade, watermark, axis ticks and labels, level lines and tags, head dot, and the capsule pill whose
 * digits roll. Colour is the up line unless an open position is losing. No React, no allocation per tick beyond the path.
 */
import { CanvasOdometer } from "./canvas-odometer";
import { LEVEL_STYLE, withAlpha } from "./chart-style";
import {
  catmullRom, easeFor, edgeAlpha, FADE_FRACTION, formatPrice, formatUsd, gridTicks, labelDecimals, PRICE_EASE, priceDecimals, SAMPLE_CAPACITY, SAMPLE_MS,
  SampleRing, SPAN_STEPS, stepFor, yOf, type YWindow,
} from "./engine";

/** Colours and fonts, read from the `--ow-*` tokens. */
export type ChartTheme = Record<"up" | "down" | "ink" | "inverse" | "helper" | "onLine" | "breakeven", string> &
  Record<"axisFont" | "pillFont" | "pillPriceFont" | "pillPnlFont" | "tagFont" | "tagStrongFont" | "markFont", string>;

export type LevelKind = "entry" | "line" | "trail" | "breakeven";

export interface ChartLevel {
  kind: LevelKind;
  price: number;
  label: string;
}

/** The open position as the chart draws it; null when flat. */
export interface ChartOverlay {
  /** Live PnL sign decides the colour (≥ 0 is up). */
  pnl: number;
  /** The pill's second row ("+$3.70"). */
  pnlText: string;
  /** The band runs between the line and this price (the entry spot). */
  entry: number | null;
  levels: ChartLevel[];
}

export interface FrameInfo {
  price: number;
  /** Eased price change this frame, in grid steps (DotGrid parallax). */
  velocitySteps: number;
  /** Pixels one sample advances (the line's scroll per sample). */
  scrollX: number;
  headX: number;
  headY: number;
}

const PAD_Y = 28;
const PILL_RIGHT = 14;
const PILL_GAP = 10;
const MIN_PLOT_LEFTOVER = 96;
const PILL_H = 26;
const PILL_H_POSITION = 34;
const LABEL_RIGHT = 14;
const TAG_H = 15;
const MAX_SAMPLES_PER_FRAME = 8;


export class ChartEngine {
  private ctx: CanvasRenderingContext2D;
  private theme: ChartTheme;
  private ring = new SampleRing(SAMPLE_CAPACITY);
  private target: number | null = null;
  private latest: number | null = null;
  private eased = 0;
  private step = 0;
  private overlay: ChartOverlay | null = null;
  private priceOdo = new CanvasOdometer();
  private pnlOdo = new CanvasOdometer();
  private lastFrame = 0;
  private sampleDebt = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private xs = new Float64Array(SAMPLE_CAPACITY);
  private ys = new Float64Array(SAMPLE_CAPACITY);
  private label: string;

  constructor(private canvas: HTMLCanvasElement, theme: ChartTheme, label: string) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    this.ctx = ctx;
    this.theme = theme;
    this.label = label;
  }

  setTheme(theme: ChartTheme): void {
    this.theme = theme;
  }

  /** Every tick, unthrottled. The first tick seeds a flat line at it. */
  setPrice(price: number): void {
    if (!(price > 0) || !Number.isFinite(price)) return;
    this.latest = price;
    if (this.target === null) {
      this.target = price;
      this.eased = price;
      this.step = stepFor(price);
      this.ring.fill(price);
      return;
    }
    this.target = price;
  }

  setOverlay(overlay: ChartOverlay | null): void {
    if ((overlay === null) !== (this.overlay === null)) this.pnlOdo.reset();
    this.overlay = overlay;
  }

  /** A new symbol: forget the line, the scale and the digits; the next tick starts a flat line. */
  reset(label: string): void {
    this.label = label;
    this.ring.clear();
    this.target = null;
    this.latest = null;
    this.step = 0;
    this.priceOdo.reset();
    this.pnlOdo.reset();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
  }

  /** One animation frame; returns what the parallax grid and the reaction overlay follow, or null before the first tick. */
  frame(nowMs: number): FrameInfo | null {
    const dt = this.lastFrame === 0 ? SAMPLE_MS : Math.min(250, nowMs - this.lastFrame);
    this.lastFrame = nowMs;
    const { ctx, width: w, height: h, theme } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.target === null || this.latest === null || w < 40 || h < 40) {
      this.drawWaiting();
      return null;
    }

    // Ease and sample on a fixed 60 Hz clock, whatever the display's rate.
    const before = this.eased;
    this.sampleDebt += dt / SAMPLE_MS;
    let pushes = Math.min(MAX_SAMPLES_PER_FRAME, Math.floor(this.sampleDebt));
    this.sampleDebt -= Math.floor(this.sampleDebt);
    const k = easeFor(PRICE_EASE, SAMPLE_MS);
    while (pushes-- > 0) {
      const d = this.target - this.eased;
      this.eased = Math.abs(d) < 1e-7 * Math.abs(this.eased) ? this.target : this.eased + d * k;
      this.ring.push(this.eased);
    }

    const overlay = this.overlay;
    const isUp = !overlay || overlay.pnl >= 0;
    const tone = isUp ? theme.up : theme.down;

    // Pill text and width first: the plot ends 10 px left of it.
    const priceText = formatUsd(this.latest, priceDecimals(this.latest));
    this.priceOdo.set(priceText, this.latest);
    if (overlay) this.pnlOdo.set(overlay.pnlText, overlay.pnl);
    this.priceOdo.step(dt);
    this.pnlOdo.step(dt);
    ctx.font = theme.pillFont;
    const charW = ctx.measureText("0").width;
    let pillTextW = charW * priceText.length;
    if (overlay) {
      ctx.font = theme.pillPnlFont;
      pillTextW = Math.max(pillTextW, ctx.measureText(overlay.pnlText).width);
    }
    const pillW = pillTextW + 18;
    const plotW = Math.min(w - PILL_RIGHT - pillW - PILL_GAP, w - MIN_PLOT_LEFTOVER);
    const half = (SPAN_STEPS * this.step) / 2;
    const win: YWindow = { center: this.eased, half, top: PAD_Y, bottom: h - PAD_Y };
    const n = this.ring.length;
    for (let i = 0; i < n; i++) {
      this.xs[i] = (i / (n - 1)) * plotW;
      this.ys[i] = yOf(this.ring.at(i), win);
    }
    const headX = plotW;
    const headY = this.ys[n - 1]!;

    this.drawGrid(win, plotW);

    const path = new Path2D();
    path.moveTo(this.xs[0]!, this.ys[0]!);
    for (let i = 0; i < n - 1; i++) {
      const [c1x, c1y, c2x, c2y] = catmullRom(this.xs, this.ys, i);
      path.bezierCurveTo(c1x, c1y, c2x, c2y, this.xs[i + 1]!, this.ys[i + 1]!);
    }

    // The PnL band: the path closed to the entry line, strongest at the price side.
    if (overlay && overlay.entry !== null) {
      const entryY = yOf(overlay.entry, win);
      const band = new Path2D(path);
      band.lineTo(plotW, entryY);
      band.lineTo(0, entryY);
      band.closePath();
      const g = ctx.createLinearGradient(0, headY, 0, entryY === headY ? headY + 1 : entryY);
      g.addColorStop(0, withAlpha(ctx, tone, 0.22));
      g.addColorStop(1, withAlpha(ctx, tone, 0.02));
      ctx.fillStyle = g;
      ctx.fill(band);
    }

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tone;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 6;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.stroke(path);

    // The tail dissolves: erase the left 32 % with a gradient.
    const fadeW = plotW * FADE_FRACTION;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const fade = ctx.createLinearGradient(0, 0, fadeW, 0);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(0.45, "rgba(0,0,0,0.55)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, fadeW, h);
    ctx.restore();

    this.drawWatermark(plotW, h);
    this.drawAxis(win, headY, overlay ? PILL_H_POSITION : PILL_H);
    if (overlay) for (const level of overlay.levels) this.drawLevel(level, win, plotW, tone);

    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(headX, headY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    this.drawPill(w, headY, pillW, tone, overlay !== null);

    const stepPx = (win.bottom - win.top) / SPAN_STEPS;
    return {
      price: this.eased,
      velocitySteps: this.step > 0 ? (this.eased - before) / this.step : 0,
      scrollX: plotW / (SAMPLE_CAPACITY - 1),
      headX,
      headY: stepPx > 0 ? headY : h / 2,
    };
  }

  private drawWaiting(): void {
    const { ctx, theme } = this;
    ctx.font = theme.tagFont;
    ctx.fillStyle = theme.helper;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Waiting for ${this.label}…`, this.width / 2, this.height / 2);
  }

  private drawGrid(win: YWindow, plotW: number): void {
    const { ctx, theme } = this;
    ctx.strokeStyle = theme.ink;
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = 1;
    for (const t of gridTicks(win.center - win.half * 1.2, win.center + win.half * 1.2, this.step)) {
      if (!t.major) continue;
      const y = Math.round(yOf(t.value, win)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawAxis(win: YWindow, headY: number, pillH: number): void {
    const { ctx, theme, width: w } = this;
    const ticks = gridTicks(win.center - win.half * 1.2, win.center + win.half * 1.2, this.step);
    const decimals = labelDecimals(win.center, this.step);
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.helper;
    ctx.font = theme.axisFont;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of ticks) {
      const y = Math.round(yOf(t.value, win)) + 0.5;
      const edge = edgeAlpha(Math.min(y - win.top, win.bottom - y));
      if (edge <= 0) continue;
      const len = t.major ? 6 : 3;
      ctx.globalAlpha = (t.major ? 0.9 : 0.45) * edge;
      ctx.beginPath();
      ctx.moveTo(3, y);
      ctx.lineTo(3 + len, y);
      ctx.moveTo(w - 3, y);
      ctx.lineTo(w - 3 - len, y);
      ctx.stroke();
      if (!t.major) continue;
      const nearPill = edgeAlpha(Math.abs(y - headY) - (pillH / 2 + 4));
      ctx.globalAlpha = edge * nearPill;
      if (ctx.globalAlpha <= 0) continue;
      ctx.fillStyle = theme.helper;
      ctx.fillText(`$${formatPrice(t.value, decimals)}`, w - LABEL_RIGHT, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawWatermark(plotW: number, h: number): void {
    const { ctx, theme } = this;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.globalAlpha = 0.07;
    ctx.font = theme.markFont;
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const target = Math.min(0.5 * plotW, 260);
    const natural = ctx.measureText("終値").width || 1;
    const scale = target / natural;
    ctx.translate(plotW / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.fillText("終値", 0, 0);
    ctx.restore();
  }

  private drawLevel(level: ChartLevel, win: YWindow, plotW: number, tone: string): void {
    const { ctx, theme, width: w } = this;
    const style = LEVEL_STYLE[level.kind];
    const colour = level.kind === "line" ? theme.down : level.kind === "breakeven" ? theme.breakeven : level.kind === "trail" ? tone : theme.ink;
    const y = yOf(level.price, win);
    ctx.font = style.strong ? theme.tagStrongFont : theme.tagFont;
    if (y < win.top - 2 || y > win.bottom + 2) {
      // Off-screen: a tag pinned 9 px inside the edge, pointing the way.
      const up = y < win.top;
      const text = `${up ? "▲" : "▼"} ${level.label} $${formatPrice(level.price)}`;
      ctx.font = theme.tagStrongFont;
      const tw = ctx.measureText(text).width + 10;
      const ty = up ? win.top - PAD_Y + 9 : win.bottom + PAD_Y - 9 - TAG_H;
      ctx.globalAlpha = 0.9 * (level.kind === "entry" ? style.alpha / 0.55 : 1);
      this.tag(text, w - LABEL_RIGHT - tw, ty, tw, colour);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = style.alpha;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dash);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(plotW, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.restore();
    const tw = ctx.measureText(level.label).width + 10;
    this.tag(level.label, w - LABEL_RIGHT - tw, y - TAG_H / 2, tw, colour);
  }

  private tag(text: string, x: number, y: number, width: number, fill: string): void {
    const { ctx, theme } = this;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, width, TAG_H, 3);
    ctx.fill();
    // Ink tags (Entry) carry the inverse ink; coloured tags carry black, as the pill does.
    ctx.fillStyle = fill === theme.ink ? theme.inverse : theme.onLine;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 5, y + TAG_H / 2 + 0.5);
  }

  private drawPill(w: number, headY: number, pillW: number, tone: string, withPnl: boolean): void {
    const { ctx, theme, height: h } = this;
    const pillH = withPnl ? PILL_H_POSITION : PILL_H;
    const x = w - PILL_RIGHT - pillW;
    const y = Math.min(h - pillH - 2, Math.max(2, headY - pillH / 2));
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.roundRect(x, y, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = theme.onLine;
    const right = x + pillW - 9;
    if (!withPnl) {
      ctx.font = theme.pillFont;
      this.priceOdo.draw(ctx, right, y + pillH / 2 + 0.5, 20, y, y + pillH);
      return;
    }
    const mid = y + pillH / 2;
    ctx.font = theme.pillPriceFont;
    this.priceOdo.draw(ctx, right, mid - 7, 16, y, mid);
    ctx.font = theme.pillPnlFont;
    this.pnlOdo.draw(ctx, right, mid + 8, 14, mid, y + pillH);
  }
}
