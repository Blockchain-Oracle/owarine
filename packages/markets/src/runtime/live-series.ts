/**
 * One live price series per symbol per tab (revamp step 2): the chart's data, kept outside React. Seeded once from ops
 * `/prices/recent` (the last half hour, a sample a second), then every streamed tick from the shared spot stream is
 * appended. A canvas reads `seriesSnapshot` inside its animation frame; nothing here re-renders a component.
 *
 * Prices are plain numbers (`priceE8 / 1e8`): the chart draws, it never settles. Times are milliseconds.
 */
import { peekClient, subscribeExchange } from "./read-runtime";
import { liveSpot, spotView, subscribeSpot } from "./spot-stream";

/** About 30 min at 2 samples a second; older points fall off the front. */
export const SERIES_CAP = 4_000;

export interface LiveSeries {
  t: number[];
  p: number[];
  /** Bumps on every change, so a reader can skip work when nothing moved. */
  version: number;
  /** True once the `/prices/recent` seed answered (or failed): an empty series after that means no feed. */
  seeded: boolean;
}

interface Entry {
  series: LiveSeries;
  listeners: Set<() => void>;
  offSpot: (() => void) | null;
  /** The stream's state at the last notification: a drop and a return re-seeds the gap from the ring. */
  wasLive: boolean;
}

const entries = new Map<string, Entry>();
/** Series kept after the last reader left, so a route change back draws the same line immediately. */
const retained = new Map<string, LiveSeries>();
const E8 = 1e8;

function append(series: LiveSeries, atMs: number, price: number): boolean {
  const n = series.t.length;
  if (n > 0) {
    const lastT = series.t[n - 1]!;
    if (atMs < lastT) return false;
    if (atMs === lastT) {
      if (series.p[n - 1] === price) return false;
      series.p[n - 1] = price;
      series.version += 1;
      return true;
    }
  }
  series.t.push(atMs);
  series.p.push(price);
  if (series.t.length > SERIES_CAP) {
    const drop = series.t.length - SERIES_CAP;
    series.t.splice(0, drop);
    series.p.splice(0, drop);
  }
  series.version += 1;
  return true;
}

/** A seed point this close to a live point is the same moment; the finer live tick wins. */
const SEED_COVER_MS = 1_000;

/**
 * Merges the `/prices/recent` samples into the series wherever it has no point within a second: history before the
 * first streamed tick, and any gap the stream left (a reconnect, a remount after the stream lingered out). Live ticks
 * are never replaced. Both inputs ascend; one linear pass.
 */
export function mergeSeed(series: LiveSeries, points: ReadonlyArray<readonly [number, number]>): void {
  if (points.length === 0) return;
  const t: number[] = [];
  const p: number[] = [];
  let i = 0;
  let added = 0;
  for (const [st, sp] of points) {
    while (i < series.t.length && series.t[i]! <= st) {
      t.push(series.t[i]!);
      p.push(series.p[i]!);
      i++;
    }
    const prev = t.length > 0 ? t[t.length - 1]! : Number.NEGATIVE_INFINITY;
    const next = i < series.t.length ? series.t[i]! : Number.POSITIVE_INFINITY;
    if (st - prev < SEED_COVER_MS || next - st < SEED_COVER_MS) continue;
    t.push(st);
    p.push(sp);
    added++;
  }
  if (added === 0) return;
  while (i < series.t.length) {
    t.push(series.t[i]!);
    p.push(series.p[i]!);
    i++;
  }
  const drop = Math.max(0, t.length - SERIES_CAP);
  series.t = t.slice(drop);
  series.p = p.slice(drop);
  series.version += 1;
}

const notify = (e: Entry) => e.listeners.forEach((l) => l());

async function seed(symbol: string, entry: Entry): Promise<void> {
  const base = peekClient()?.priceFeedUrl;
  if (!base) {
    // Subscribed before the runtime was configured: seed once it is.
    const off = subscribeExchange(() => {
      off();
      void seed(symbol, entry);
    });
    return;
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/prices/recent?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" } as RequestInit);
    if (!res.ok) return;
    const body = (await res.json()) as { points?: Array<[number, string]> };
    const points = (body.points ?? []).filter((r) => Array.isArray(r) && typeof r[0] === "number").map(([t, p]) => [t, Number(p) / E8] as const);
    mergeSeed(entry.series, points);
  } catch {
    // No seed: the line starts at the first streamed tick.
  } finally {
    entry.series.seeded = true;
    entry.series.version += 1;
    notify(entry);
  }
}

/** Subscribes to a symbol's live series; the first subscriber seeds it and joins the spot stream. */
export function subscribeSeries(symbol: string, listener: () => void): () => void {
  let entry = entries.get(symbol);
  if (!entry) {
    const created: Entry = { series: retained.get(symbol) ?? { t: [], p: [], version: 0, seeded: false }, listeners: new Set(), offSpot: null, wasLive: false };
    retained.delete(symbol);
    entries.set(symbol, created);
    entry = created;
    created.offSpot = subscribeSpot(symbol, () => {
      const live = spotView(symbol).live;
      if (live && !created.wasLive && created.series.t.length > 0) void seed(symbol, created);
      created.wasLive = live;
      const tick = liveSpot(symbol);
      if (tick && append(created.series, tick.publishTimeMs, Number(tick.priceE8) / E8)) notify(created);
    });
    void seed(symbol, created);
  }
  entry.listeners.add(listener);
  const mine = entry;
  return () => {
    mine.listeners.delete(listener);
    if (mine.listeners.size > 0) return;
    // The series is kept (a remount redraws at once); only the stream membership is dropped.
    mine.offSpot?.();
    entries.delete(symbol);
    retained.set(symbol, mine.series);
  };
}

const EMPTY: LiveSeries = Object.freeze({ t: [], p: [], version: 0, seeded: false }) as LiveSeries;

export function seriesSnapshot(symbol: string): LiveSeries {
  return entries.get(symbol)?.series ?? retained.get(symbol) ?? EMPTY;
}

/** Test seam: forget every series. */
export function resetLiveSeries(): void {
  for (const e of entries.values()) e.offSpot?.();
  entries.clear();
  retained.clear();
}
