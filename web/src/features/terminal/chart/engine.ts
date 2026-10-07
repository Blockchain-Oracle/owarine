/**
 * The live chart's maths (revamp step 2, Tradash's chart): pure functions the animation frame calls. No DOM, no React.
 *
 * Time runs left to right in a rolling window whose right edge sits `leadFrac` of the span ahead of now, so the head
 * of the line breathes at ~80% of the width. The y-range eases toward the visible extent (padded, never thinner than
 * `minSpanFrac` of the price) so a quiet market still shows its cents and a jump is followed, not snapped to.
 */

export interface View {
  /** Visible time range, ms. */
  t0: number;
  t1: number;
  /** Visible price range. */
  lo: number;
  hi: number;
}

export interface Plot {
  /** Drawable box inside the canvas, CSS pixels. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Exponential approach factor for a frame of `dtMs` toward a target with time constant `tauMs`. */
export const approach = (dtMs: number, tauMs: number): number => (tauMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / tauMs));

export const xOf = (t: number, v: View, p: Plot): number => p.x0 + ((t - v.t0) / (v.t1 - v.t0)) * (p.x1 - p.x0);
export const yOf = (price: number, v: View, p: Plot): number => p.y1 - ((price - v.lo) / (v.hi - v.lo)) * (p.y1 - p.y0);

/** First index with `t[i] >= at` (binary search over ascending times). */
export function lowerBound(t: readonly number[], at: number): number {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (t[mid]! < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The rolling time window: `spanMs` wide, now at `1 − leadFrac` of the width. */
export function timeWindow(nowMs: number, spanMs: number, leadFrac = 0.2): { t0: number; t1: number } {
  const t1 = nowMs + spanMs * leadFrac;
  return { t0: t1 - spanMs, t1 };
}

/**
 * The price range the view should settle on: min/max of the visible points, the head and any pinned prices (the open
 * print, the entry), padded by `padFrac` of the extent each side, at least `minSpanFrac × price` tall.
 */
export function targetRange(input: { t: readonly number[]; p: readonly number[]; t0: number; head: number; pinned?: readonly (number | null | undefined)[]; padFrac?: number; minSpanFrac?: number }): { lo: number; hi: number } {
  let lo = input.head;
  let hi = input.head;
  // One point before the window keeps the line's left edge in range.
  for (let i = Math.max(0, lowerBound(input.t, input.t0) - 1); i < input.p.length; i++) {
    const v = input.p[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  for (const v of input.pinned ?? []) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const mid = (lo + hi) / 2;
  const minSpan = Math.abs(mid) * (input.minSpanFrac ?? 0.0002);
  let span = hi - lo;
  if (span < minSpan) {
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
    span = minSpan;
  }
  const pad = span * (input.padFrac ?? 0.18);
  return { lo: lo - pad, hi: hi + pad };
}

/** Eases the current range toward the target; returns the target on the first frame. */
export function easeRange(current: { lo: number; hi: number } | null, target: { lo: number; hi: number }, k: number): { lo: number; hi: number } {
  if (!current || !Number.isFinite(current.lo) || !Number.isFinite(current.hi)) return target;
  return { lo: current.lo + (target.lo - current.lo) * k, hi: current.hi + (target.hi - current.hi) * k };
}

/** "Nice" grid steps (1, 2, 2.5, 5 × 10ⁿ) giving about `count` lines across the range. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Decimals a price is shown with: cents for anything ≥ $1, more below. */
export function priceDecimals(price: number): number {
  const a = Math.abs(price);
  if (a >= 1) return 2;
  if (a >= 0.01) return 4;
  return 6;
}

/** Decimals a grid label needs so neighbouring lines read differently (a $0.50 step on BTC shows cents). */
export function stepDecimals(step: number, price: number): number {
  if (!(step > 0)) return priceDecimals(price);
  for (let d = 0; d <= 8; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d;
  }
  return 8;
}

export function formatPrice(price: number, decimals = priceDecimals(price)): string {
  return price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Parses a CSS number token (`"84"`, `" 2 "`); falls back when absent or not a number. */
export function cssNumber(raw: string | null | undefined, fallback: number): number {
  const n = Number.parseFloat(String(raw ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

/** Which side of the open print the head is on, for a position's band: null with no position or no open print. */
export function winning(side: "up" | "down" | null, head: number, open: number | null): boolean | null {
  if (!side || open === null) return null;
  // Ties settle Up (PD-3).
  return side === "up" ? head >= open : head < open;
}
