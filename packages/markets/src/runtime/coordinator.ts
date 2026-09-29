/**
 * The ladder coordinator: one normalised price ladder per Window, shared by every consumer (first-call.md §2.2 shape).
 *
 * C1 stub. The reference fed this from Solana account subscriptions; on Canton it is fed by the venue's published
 * price ladder over SSE (C4). Until then every subscribed Window's reading is the honest not-deployed answer, never a
 * `null` that would leave a card or the ticket on a skeleton. The reading is one shared object, because
 * `useSyncExternalStore` requires a stable snapshot.
 */
import type { BookTarget } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { BookDepth } from "@agari/core/types";
import { cantonNotLive, notDeployedReading } from "../stub/not-deployed";
import type { BookState, SeriesFacts } from "./accounts";
import { BOOK_LEVELS } from "./mappers";

/** How many levels each side a coordinated ladder carries; callers slice what they display. */
export const CANONICAL_BOOK_DEPTH = BOOK_LEVELS;

/** The raw ladder and its Series behind a Window's reading, for the ticket's quote walk. */
export interface BookStateView {
  book: BookState;
  series: SeriesFacts;
  live: boolean;
}

const NOT_LIVE: Reading<BookDepth> = notDeployedReading(cantonNotLive("price ladder"));

/** Subscribes to one Window's ladder; nothing is pushed until the Canton ladder stream lands (C4). */
export function subscribeBook(_target: BookTarget, _listener: () => void): () => void {
  return () => undefined;
}

export function bookSnapshot(marketId: string | null): Reading<BookDepth> | null {
  return marketId === null ? null : NOT_LIVE;
}

/** No ladder to walk yet, so no view: the ticket falls back to `bookSnapshot`'s error. */
export function bookStateSnapshot(_marketId: string | null): BookStateView | null {
  return null;
}

export function resetCoordinator(): void {}
