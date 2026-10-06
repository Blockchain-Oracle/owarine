import type { AutoscaleInfo, IPriceLine, ISeriesApi } from "lightweight-charts";

/**
 * The chart's bookkeeping between renders, kept apart from the canvas so it can be tested without one.
 *
 * One mounted chart outlives the market it first drew: the live hero, the ticket's mini chart and a reel all keep
 * their `PriceChart` when the selection moves to another Window. So nothing drawn may be assumed to belong to the
 * market on screen now — the reference line and the series both follow the props they are given.
 */

/** What the series last drew: enough to tell one more tick of the same series from a different series. */
export interface DrawnSeries {
  count: number;
  firstTime: number | null;
  lastTime: number | null;
}

export const NOTHING_DRAWN: DrawnSeries = { count: 0, firstTime: null, lastTime: null };

export function drawnOf(data: readonly { time: number }[]): DrawnSeries {
  return { count: data.length, firstTime: data[0]?.time ?? null, lastTime: data.at(-1)?.time ?? null };
}

/**
 * True only when `data` is the drawn series plus one later tick, so the chart may append instead of redrawing.
 * Another market's points (or a history re-based on a new Window) can have exactly one more point by chance: the
 * same first time and a later last time are what make it the same series.
 */
export function isOneTickMore(drawn: DrawnSeries, data: readonly { time: number }[]): boolean {
  const last = data.at(-1);
  return (
    last !== undefined &&
    data.length === drawn.count + 1 &&
    drawn.firstTime !== null &&
    data[0]?.time === drawn.firstTime &&
    drawn.lastTime !== null &&
    last.time > drawn.lastTime
  );
}

type LineSeriesLike = Pick<ISeriesApi<"Line">, "applyOptions" | "removePriceLine">;

/** Keeps the reference price inside the visible range; the series alone would autoscale it out of view. `null` drops it. */
export function autoscaleWith(series: LineSeriesLike, price: number | null): void {
  series.applyOptions({
    autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
      const info = original();
      if (price === null || !info?.priceRange) return info;
      const { minValue, maxValue } = info.priceRange;
      return { ...info, priceRange: { minValue: Math.min(minValue, price), maxValue: Math.max(maxValue, price) } };
    },
  });
}

/**
 * Puts the reference line at `price` under `title`, moving the line already drawn rather than leaving it at the level
 * of the market the chart showed before. `price === null` (a print still pending) removes it: no line at a guessed
 * level, and none at another market's. Returns the line now drawn.
 */
export function syncReferenceLine(
  series: LineSeriesLike,
  line: IPriceLine | null,
  price: number | null,
  title: string,
  create: (price: number, title: string) => IPriceLine,
): IPriceLine | null {
  autoscaleWith(series, price);
  if (price === null) {
    if (line) series.removePriceLine(line);
    return null;
  }
  if (!line) return create(price, title);
  line.applyOptions({ price, title });
  return line;
}
