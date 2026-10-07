/**
 * The last half hour of spot per symbol, one sample a second (revamp step 2): `/prices/recent?symbol=BTC` seeds a
 * live chart the moment a tab opens, so the line has a past before the first streamed tick. In memory only, filled
 * from the process's own spot feed; a restart starts it empty and the chart falls back to the print archive.
 *
 * Wire: `{ symbol, points: [[timeMs, "priceE8"], …] }`, oldest first; the last sample in each second wins.
 */
import type { SpotFeed } from "./spot";

export const RECENT_SPAN_SEC = 30 * 60;

export interface RecentRing {
  points(symbol: string): Array<[number, string]>;
  stop(): void;
}

export function createRecentRing(spot: SpotFeed, spanSec = RECENT_SPAN_SEC): RecentRing {
  const bySymbol = new Map<string, Array<[number, bigint]>>();
  const off = spot.subscribe((q) => {
    const atMs = q.publishTimeMs ?? q.publishTimeSec * 1000;
    let ring = bySymbol.get(q.symbol);
    if (!ring) bySymbol.set(q.symbol, (ring = []));
    const last = ring.at(-1);
    if (last && atMs < last[0]) return;
    if (last && Math.floor(last[0] / 1000) === Math.floor(atMs / 1000)) ring[ring.length - 1] = [atMs, q.priceE8];
    else ring.push([atMs, q.priceE8]);
    const cutoff = atMs - spanSec * 1000;
    let drop = 0;
    while (drop < ring.length && ring[drop]![0] < cutoff) drop++;
    if (drop > 0) ring.splice(0, drop);
  });
  return {
    points: (symbol) => (bySymbol.get(symbol) ?? []).map(([t, p]) => [t, p.toString()]),
    stop: off,
  };
}
