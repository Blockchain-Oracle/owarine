"use client";

import type { LivePnlView } from "@owarine/markets/react";
import { liveSpot, peekClient } from "@owarine/markets/runtime";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { TerminalPosition } from "./useTerminalTrade";

/**
 * Trade replays, to Tradash's (`tradash.replays.v1`; SPEC-flow §7): while a position is open its price path is sampled
 * every 100 ms — with the live PnL beside each price, so a replay shows the PnL the screen showed, not a recomputation —
 * halving the resolution past 900 samples. A gap left by a hidden tab is back-filled from 1-minute candles when the tab
 * returns. Kept per browser: at most 150 episodes and about 1.5 MB, falling back to the newest 20.
 */
export interface Episode {
  /** The position's id (paper `p:…`, seat `s:<marketId>`). */
  positionId: string;
  marketId: string;
  asset: string;
  side: "up" | "down";
  intervalSec: number;
  entrySpot: number | null;
  line: number | null;
  openedAtMs: number;
  closedAtMs: number | null;
  /** [timeMs, price, pnl in credits]; pnl null where back-filled. */
  samples: Array<[number, number, number | null]>;
}

const KEY = "owarine.trade.replays.v1";
const SAMPLE_MS = 100;
const HALVE_AT = 900;
const MAX_EPISODES = 150;
const MAX_BYTES = 1_500_000;
const FALLBACK_EPISODES = 20;
const PERSIST_MS = 2_000;
/** A gap longer than this is a hole in the recording (the tab was hidden or the stream down). */
export const GAP_MS = Math.max(3_000, 4 * SAMPLE_MS);

const listeners = new Set<() => void>();
let episodes: Episode[] = [];
let hydrated = false;
let dirty = false;

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Episode[]) : [];
    episodes = Array.isArray(parsed) ? parsed.filter((e) => typeof e?.positionId === "string" && Array.isArray(e.samples)) : [];
  } catch {
    episodes = [];
  }
}

function persist(): void {
  if (!dirty) return;
  dirty = false;
  try {
    let list = episodes.slice(0, MAX_EPISODES);
    let text = JSON.stringify(list);
    if (text.length > MAX_BYTES) {
      list = list.slice(0, FALLBACK_EPISODES);
      text = JSON.stringify(list);
    }
    globalThis.localStorage?.setItem(KEY, text);
  } catch {
    // Storage full or blocked: replays last for this tab.
  }
}

/** A new array reference, so `useSyncExternalStore` readers see the change. */
const notify = () => {
  episodes = [...episodes];
  listeners.forEach((l) => l());
};

export function useEpisodes(): Episode[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => (hydrate(), episodes),
    () => episodes,
  );
}

/** Keeps every other sample once there are too many (the first and the last always stay). */
export function halve(samples: Episode["samples"]): Episode["samples"] {
  if (samples.length <= HALVE_AT) return samples;
  const out = samples.filter((_, i) => i % 2 === 0);
  if (out.at(-1) !== samples.at(-1)) out.push(samples.at(-1)!);
  return out;
}

/** How much of the episode's time the samples cover (gaps over `GAP_MS` count as uncovered). */
export function coverage(e: Pick<Episode, "samples">): number {
  const s = e.samples;
  if (s.length < 2) return 0;
  const span = s.at(-1)![0] - s[0]![0];
  if (span <= 0) return 0;
  let covered = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i]![0] - s[i - 1]![0];
    if (d <= GAP_MS) covered += d;
  }
  return covered / span;
}

/** Tradash's rule: at least 30 samples, at least 60 % covered, and no unfilled gap in the middle 80 %. */
export function replayable(e: Episode): boolean {
  const s = e.samples;
  if (s.length < 30 || coverage(e) < 0.6) return false;
  const t0 = s[0]![0];
  const span = s.at(-1)![0] - t0;
  for (let i = 1; i < s.length; i++) {
    const mid = (s[i]![0] + s[i - 1]![0]) / 2;
    const inMiddle = mid - t0 > span * 0.1 && mid - t0 < span * 0.9;
    if (inMiddle && s[i]![0] - s[i - 1]![0] > GAP_MS) return false;
  }
  return true;
}

/** Linear prices every second across `[from, to]` from 1-minute candles (closes at bucket ends). */
export function interpolateCandles(candles: ReadonlyArray<[number, number, number, number, number]>, from: number, to: number): Array<[number, number, null]> {
  const points = candles.map(([t, , , , c]) => [t + 60_000, c] as const).sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number, null]> = [];
  for (let t = from + 1_000; t < to; t += 1_000) {
    const j = points.findIndex((p) => p[0] >= t);
    if (j <= 0) continue;
    const [ta, pa] = points[j - 1]!;
    const [tb, pb] = points[j]!;
    out.push([t, pa + ((pb - pa) * (t - ta)) / (tb - ta), null]);
  }
  return out;
}

async function backfill(e: Episode, spotSymbol: string): Promise<void> {
  const last = e.samples.at(-1);
  const base = peekClient()?.priceFeedUrl?.replace(/\/$/, "");
  if (!last || !base || Date.now() - last[0] <= GAP_MS) return;
  try {
    const res = await fetch(`${base}/prices/candles?symbol=${encodeURIComponent(spotSymbol)}&interval=1m&count=${Math.min(300, Math.ceil((Date.now() - last[0]) / 60_000) + 2)}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { candles?: Array<[number, number, number, number, number]> };
    const filled = interpolateCandles(body.candles ?? [], last[0], Date.now());
    if (filled.length === 0) return;
    e.samples = halve([...e.samples, ...filled]);
    dirty = true;
    notify();
  } catch {
    // The gap stays; the episode says how much it recorded.
  }
}

/**
 * Records every open position's path at 100 ms while the screen is open; closes an episode when its position goes;
 * back-fills a hidden-tab gap when the tab returns.
 */
export function useReplayRecorder(positions: readonly TerminalPosition[], book: ReadonlyMap<string, LivePnlView>): void {
  const live = useRef({ positions, book });
  live.current = { positions, book };

  useEffect(() => {
    hydrate();
    const tick = () => {
      const now = Date.now();
      const open = new Set<string>();
      for (const p of live.current.positions) {
        open.add(p.id);
        const tick = liveSpot(p.spotSymbol);
        if (!tick) continue;
        let e = episodes.find((x) => x.positionId === p.id && x.closedAtMs === null);
        if (!e) {
          e = { positionId: p.id, marketId: p.marketId, asset: p.asset, side: p.side, intervalSec: p.intervalSec, entrySpot: p.entrySpot, line: p.linePrice, openedAtMs: p.openedAtMs || now, closedAtMs: null, samples: [] };
          episodes = [e, ...episodes];
        }
        const v = live.current.book.get(p.id);
        const pnl = v && v.fillableLots > 0n ? Number(v.pnlBase) / 10 ** p.decimals : null;
        const price = Number(tick.priceE8) / 1e8;
        const last = e.samples.at(-1);
        if (!last || now - last[0] >= SAMPLE_MS) {
          e.samples = halve([...e.samples, [now, price, pnl]]);
          dirty = true;
        }
      }
      for (const e of episodes) {
        if (e.closedAtMs === null && !open.has(e.positionId)) {
          e.closedAtMs = now;
          dirty = true;
          notify();
        }
      }
    };
    const sampler = setInterval(tick, SAMPLE_MS);
    const saver = setInterval(persist, PERSIST_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      for (const p of live.current.positions) {
        const e = episodes.find((x) => x.positionId === p.id && x.closedAtMs === null);
        if (e) void backfill(e, p.spotSymbol);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(sampler);
      clearInterval(saver);
      document.removeEventListener("visibilitychange", onVisible);
      persist();
    };
  }, []);
}

/** The episode behind a history row: paper rows carry their position id; seat rows match by Window. */
export function episodeFor(all: readonly Episode[], row: { id: string; marketId?: string }): Episode | null {
  return all.find((e) => row.id.startsWith(`${e.positionId}:`)) ?? (row.marketId ? (all.find((e) => e.marketId === row.marketId && e.positionId.startsWith("s:")) ?? null) : null);
}
