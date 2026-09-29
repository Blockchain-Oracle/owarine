/**
 * Realised volatility from bar closes (plan "Prices and lanes": BTC/ETH realised-vol re-measure before their fair
 * values go live). Pure: the ops vol meter feeds it the exchanges' 1-minute candles, the evidence probe feeds it the
 * same, and the pricer only ever sees the annualised number it returns.
 *
 * σ is the sample standard deviation of log returns between consecutive bars, scaled by √(bars per year). A 24/7 asset
 * accrues variance every second of a calendar year (`CALENDAR_YEAR_SEC`), which is the point of the re-measure: the
 * equity placeholder annualised over 252 × 6.5 h would overstate a crypto σ per second by √(365 × 24 / 1638) ≈ 2.3×.
 * A missing bar is not a zero return: returns are taken only between bars exactly one bar apart.
 */

export interface Close {
  /** Bar start (or end: only the spacing matters), unix seconds. */
  sec: number;
  /** The bar's close, any positive scale. */
  price: number;
}

export interface RealisedVol {
  /** Annualised σ in basis points (10,000 = 100 %). */
  sigmaBps: number;
  /** Returns the estimate stands on. */
  returns: number;
  /** First and last bar used. */
  fromSec: number;
  toSec: number;
}

/** Log returns between bars exactly `barSec` apart, oldest first; duplicate bars keep the first. */
export function logReturns(closes: readonly Close[], barSec: number): number[] {
  const sorted = [...closes].filter((c) => Number.isFinite(c.price) && c.price > 0).sort((a, b) => a.sec - b.sec);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.sec - prev.sec === barSec) out.push(Math.log(cur.price / prev.price));
  }
  return out;
}

/**
 * Annualised realised σ, or null with fewer than `minReturns` returns (default 120: two hours of 1-minute bars).
 * `yearSec` is the variance clock: `CALENDAR_YEAR_SEC` for a 24/7 asset.
 */
export function realisedVol(closes: readonly Close[], barSec: number, yearSec: number, minReturns = 120): RealisedVol | null {
  if (!(barSec > 0) || !(yearSec > 0)) throw new Error("realisedVol needs a positive bar and year");
  const r = logReturns(closes, barSec);
  if (r.length < Math.max(2, minReturns)) return null;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
  const sigma = Math.sqrt(variance) * Math.sqrt(yearSec / barSec);
  const secs = closes.map((c) => c.sec);
  return { sigmaBps: Math.round(sigma * 10_000), returns: r.length, fromSec: Math.min(...secs), toSec: Math.max(...secs) };
}

/** The median of several sources' estimates (the three exchanges), rounded to whole bps; null when none measured. */
export function medianSigmaBps(values: readonly (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}
