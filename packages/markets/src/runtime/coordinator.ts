/**
 * The ladder coordinator: one normalised price ladder per Window, shared by every consumer (first-call.md §2.2 shape).
 *
 * On Canton it is fed by the venue's published price ladder (ops `/ladders/stream`, snapshot first, then one event per
 * changed Window; `/ladders/latest` fills the gap before the stream opens), mapped by `ladder.ts` onto the walkable
 * Book core's kernel already walks. It is indicative: the venue's own prices, not a public order book, and the firm
 * price comes only from the click-time quote. A Window the venue publishes no ladder for reads as an empty ladder
 * once the first snapshot has arrived ("no quotes"), never a skeleton that never resolves; a stream that dropped keeps
 * the last ladder, flagged stale. Readings are stable objects, because `useSyncExternalStore` requires them.
 */
import type { BookTarget } from "@owarine/core/ports";
import type { Reading, ReadingOk } from "@owarine/core/schemas";
import type { Address, BookDepth } from "@owarine/core/types";
import { peekSeries, readSeries, readVenueStatic, type BookState, type SeriesFacts } from "./accounts";
import { decideBookEmit, reuseBookValue } from "./book-reading";
import { openStream, type StreamSource } from "./event-source";
import { ladderBase, ladderBookState, ladderLatestWire, parseLadder, type Ladder } from "./ladder";
import { BOOK_LEVELS, EMPTY_BOOK_DEPTH, toBookDepth } from "./mappers";
import { peekClient } from "./read-runtime";

/** How many levels each side a coordinated ladder carries; callers slice what they display. */
export const CANONICAL_BOOK_DEPTH = BOOK_LEVELS;

/** The raw ladder and its Series behind a Window's reading, for the ticket's quote walk. */
export interface BookStateView {
  book: BookState;
  series: SeriesFacts;
  live: boolean;
}

/** Levels expire at `quotingUntilSec` by the clock, not by an event: re-derive this often while anyone listens. */
const TICK_MS = 2_000;
const RETRY_MIN_MS = 3_000;
const RETRY_MAX_MS = 60_000;
const LINGER_MS = 5_000;

interface Entry {
  target: BookTarget;
  listeners: Set<() => void>;
  reading: ReadingOk<BookDepth> | null;
  view: BookStateView | null;
}

const entries = new Map<string, Entry>();
const ladders = new Map<string, Ladder>();
let snapshotSeen = false;
let live = false;
let generation = 0;
let source: StreamSource | null = null;
let retryMs = RETRY_MIN_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let lingerTimer: ReturnType<typeof setTimeout> | null = null;
let decimals: number | null = null;

const nowSec = () => Math.floor(Date.now() / 1000);

function derive(entry: Entry): void {
  const ladder = ladders.get(entry.target.marketId) ?? null;
  const dec = decimals ?? entry.target.decimals;
  let value: BookDepth;
  let view: BookStateView | null = null;
  if (ladder) {
    const series = peekSeries(ladder.seriesId);
    if (!series) {
      // The Series' terms (lot and tick sizes) are one read away; derive again once they land.
      void readSeries(ladder.seriesId as Address).then(() => derive(entry), () => undefined);
      return;
    }
    const book = ladderBookState(ladder, generation);
    view = { book, series, live };
    value = toBookDepth(book, series, dec, nowSec());
  } else {
    if (!snapshotSeen) return;
    value = EMPTY_BOOK_DEPTH(dec);
  }
  const emit = decideBookEmit(entry.reading, reuseBookValue(entry.reading?.value, value), live || !ladder, Date.now());
  if (emit.hold) return;
  entry.reading = emit.reading;
  entry.view = view;
  for (const listener of entry.listeners) listener();
}

function deriveAll(): void {
  for (const entry of entries.values()) derive(entry);
}

function take(raw: unknown): void {
  const ladder = parseLadder(raw);
  if (!ladder) return;
  ladders.set(ladder.marketId, ladder);
  generation += 1;
  const entry = entries.get(ladder.marketId);
  if (entry) derive(entry);
}

async function fillFromLatest(base: string): Promise<void> {
  try {
    const res = await fetch(`${base}/ladders/latest`, { cache: "no-store", headers: { accept: "application/json" } } as RequestInit);
    if (!res.ok) return;
    const parsed = ladderLatestWire.safeParse(await res.json());
    if (!parsed.success) return;
    for (const raw of parsed.data.ladders) take(raw);
    snapshotSeen = true;
    deriveAll();
  } catch {
    // The stream's own snapshot fills it when it opens.
  }
}

function setLive(next: boolean): void {
  if (live === next) return;
  live = next;
  deriveAll();
}

function open(): void {
  const base = ladderBase(peekClient());
  if (source || !base || entries.size === 0) return;
  if (decimals === null) void readVenueStatic().then((v) => ((decimals = v.decimals), deriveAll()), () => undefined);
  if (!snapshotSeen) void fillFromLatest(base);
  const stream = openStream(`${base}/ladders/stream`);
  if (!stream) {
    // No SSE here (a server process): the latest snapshot, refreshed on the tick, stands in for the stream.
    live = true;
    return;
  }
  source = stream;
  stream.listen("ladder", (data) => {
    try {
      take(JSON.parse(data));
      snapshotSeen = true;
      retryMs = RETRY_MIN_MS;
      setLive(true);
    } catch {
      // A malformed event is dropped; the next one carries the Window again.
    }
  });
  stream.onError((closed) => {
    if (stream !== source) return;
    setLive(false);
    if (!closed) return;
    source = null;
    retryTimer ??= setTimeout(() => {
      retryTimer = null;
      open();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  });
}

function close(): void {
  source?.close();
  source = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
  live = false;
}

/** Subscribes to one Window's ladder; the first subscriber opens the stream, the last one closes it after a linger. */
export function subscribeBook(target: BookTarget, listener: () => void): () => void {
  let entry = entries.get(target.marketId);
  if (!entry) {
    entry = { target, listeners: new Set(), reading: null, view: null };
    entries.set(target.marketId, entry);
  }
  entry.listeners.add(listener);
  if (lingerTimer) clearTimeout(lingerTimer);
  lingerTimer = null;
  open();
  const base = ladderBase(peekClient());
  tickTimer ??= setInterval(() => {
    if (!source && base) void fillFromLatest(base);
    deriveAll();
  }, TICK_MS);
  derive(entry);
  const mine = entry;
  return () => {
    mine.listeners.delete(listener);
    if (mine.listeners.size === 0) entries.delete(target.marketId);
    if (entries.size > 0) return;
    lingerTimer ??= setTimeout(() => {
      lingerTimer = null;
      if (entries.size === 0) close();
    }, LINGER_MS);
  };
}

/** Null while the first ladder snapshot is on its way; then the Window's ladder (empty when it has none). */
export function bookSnapshot(marketId: string | null): Reading<BookDepth> | null {
  return marketId === null ? null : (entries.get(marketId)?.reading ?? null);
}

/** The walkable ladder and its Series, for the ticket's quote; null while there is none to walk. */
export function bookStateSnapshot(marketId: string | null): BookStateView | null {
  return marketId === null ? null : (entries.get(marketId)?.view ?? null);
}

export function resetCoordinator(): void {
  close();
  entries.clear();
  ladders.clear();
  snapshotSeen = false;
  generation = 0;
  decimals = null;
}
