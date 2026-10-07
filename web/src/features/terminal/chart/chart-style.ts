/** The chart's level-line styles (Tradash's dashes and widths) and a token-colour-at-alpha helper. */
import type { LevelKind } from "./chart-engine";

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
