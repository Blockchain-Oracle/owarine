/** The chart's shared types, metrics and level styles (Tradash's dashes and widths), and a token-colour-at-alpha helper. */

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
  /** The pill's second row ("+3.70"). */
  pnlText: string;
  /** The band runs between the line and this price (the entry spot). */
  entry: number | null;
  levels: ChartLevel[];
}

export interface FrameInfo {
  price: number;
  /** Eased price change this frame, in grid steps (DotGrid parallax). */
  velocitySteps: number;
  /** Pixels the view scrolled this frame (one sample in line view; the slide or pan in candles). */
  scrollX: number;
  headX: number;
  headY: number;
}

export type ChartView = "line" | "candles";

export const PAD_Y = 28;
export const PILL_RIGHT = 14;
export const PILL_GAP = 10;
export const MIN_PLOT_LEFTOVER = 96;
export const PILL_H = 26;
export const PILL_H_POSITION = 34;
export const LABEL_RIGHT = 14;
export const TAG_H = 15;

export const LEVEL_STYLE: Record<LevelKind, { dash: number[]; width: number; alpha: number; strong?: boolean }> = {
  entry: { dash: [4, 4], width: 1, alpha: 0.55 },
  breakeven: { dash: [1, 3], width: 1, alpha: 0.75 },
  line: { dash: [2, 3], width: 1, alpha: 0.7 },
  trail: { dash: [6, 3], width: 1.5, alpha: 1, strong: true },
};

/** A token colour at an alpha, via the canvas's own parser (handles hex, rgb() and named colours). */
const alphaCache = new Map<string, string>();
export function withAlpha(ctx: CanvasRenderingContext2D, colour: string, alpha: number): string {
  const key = `${colour}|${alpha}`;
  const hit = alphaCache.get(key);
  if (hit) return hit;
  ctx.fillStyle = colour;
  const parsed = ctx.fillStyle;
  let out = colour;
  if (parsed.startsWith("#") && parsed.length === 7) {
    const r = Number.parseInt(parsed.slice(1, 3), 16);
    const g = Number.parseInt(parsed.slice(3, 5), 16);
    const b = Number.parseInt(parsed.slice(5, 7), 16);
    out = `rgba(${r},${g},${b},${alpha})`;
  } else if (parsed.startsWith("rgb")) out = parsed.replace(/rgba?\(([^)]+)\)/, (_, inner: string) => `rgba(${inner.split(",").slice(0, 3).join(",")},${alpha})`);
  alphaCache.set(key, out);
  return out;
}
