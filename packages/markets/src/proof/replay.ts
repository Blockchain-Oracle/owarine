/**
 * The Pyth proof replay's surface. The reference re-posted an archived Pyth update to the Solana receiver and read the
 * account back; Canton has no Pyth receiver and needs none: C5 re-verifies an archived price from its payload and the
 * `payloadHash` on the `PriceQuote` contract. Until then every replay is refused (`not-live`) before the store is
 * touched or anything is claimed. Pure feed lookups and the error redaction are kept. Server-only.
 */
import { TICKERS, type Ticker, type TickerSymbol } from "@agari/core/market";
import type { Hash32 } from "@agari/core/types";
import { cantonNotLive } from "../stub/not-deployed";
import type { ArchivedUpdate, PreflightRefusal } from "./hermes";
import type { ProofStore, StoredPrint, VerifiedProofRow } from "./store";

export const PYTH_SOURCE = 1;
/** A `posting` claim older than this belongs to a run that died; the next caller may post again. */
export const POSTING_STALE_MS = 10 * 60_000;

export interface ReplayDeps {
  store: ProofStore;
  rpcUrl: string;
  payerSecret: Uint8Array;
  nowMs?: () => number;
}

export type ReplayRefusal =
  | { kind: "no-print" }
  | { kind: "not-pyth"; source: number }
  | { kind: "no-feed"; symbol: string | null }
  | { kind: "not-archived"; feed: string; boundarySec: number }
  | { kind: "preflight"; reason: PreflightRefusal }
  /** C1: the Canton re-verification is not live yet. */
  | { kind: "not-live"; reason: string };

export type ReplayOutcome =
  | { kind: "verified"; boundarySec: number; rows: VerifiedProofRow[] }
  | { kind: "refused"; refusal: ReplayRefusal }
  | { kind: "in-progress" | "already-verified"; boundarySec: number }
  | { kind: "failed"; boundarySec: number; error: string };

const bareHex = (id: string) => id.replace(/^0x/, "").toLowerCase();

/** The Pyth feed a ticker's prints carry: its trial feed, or for a valuation lane (S20) the valuation index it settles on. Null for a pre-IPO name. */
const printFeedOf = (t: Ticker): Hash32 | null => t.pythFeedId ?? (t.kind === "valuation" ? t.pythIndexFeedId : null);

/** The registry ticker whose Pyth feed this is; the trial update carries TSLA, QQQ and VOO, a valuation lane its index. A pre-IPO name has no feed. */
export function symbolOfPythFeed(feedHex: string): TickerSymbol | null {
  const want = bareHex(feedHex);
  const hit = Object.values(TICKERS).find((t) => {
    const feed = printFeedOf(t);
    return feed !== null && bareHex(feed) === want;
  });
  return hit?.symbol ?? null;
}

export function pythFeedOf(symbol: string | null): string | null {
  if (!symbol || !(symbol in TICKERS)) return null;
  const id = printFeedOf(TICKERS[symbol as TickerSymbol]);
  return id === null ? null : bareHex(id);
}

/** Provider URLs can carry keys: an error that reaches a row or a response keeps only its words. */
export function redactError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\b(?:https?|wss?):\/\/\S+/g, "<rpc>").slice(0, 400);
}

/** A claimed replay: the print, its archived update and the feeds one post will create. */
export interface PreparedReplay {
  print: StoredPrint;
  feed: string;
  boundarySec: number;
  archived: ArchivedUpdate;
  feeds: Array<{ feed: string; symbol: string }>;
  payer: string;
}

const NOT_LIVE: ReplayRefusal = { kind: "not-live", reason: cantonNotLive("proof") };

/** Refused before anything is read or claimed: there is no receiver to post to on Canton (C5 re-verifies instead). */
export async function prepareReplay(_deps: ReplayDeps, _input: { market: string; which: number }): Promise<{ kind: "claimed"; prepared: PreparedReplay } | Exclude<ReplayOutcome, { kind: "verified" | "failed" }>> {
  return { kind: "refused", refusal: NOT_LIVE };
}

/** Never reached on Canton (nothing is ever claimed); answers `failed` without writing, should a caller try. */
export async function postPreparedReplay(_deps: ReplayDeps, prepared: PreparedReplay): Promise<Extract<ReplayOutcome, { kind: "verified" | "failed" }>> {
  return { kind: "failed", boundarySec: prepared.boundarySec, error: cantonNotLive("proof") };
}

/** Re-verifies one recorded print: refused on Canton until C5. */
export async function replayPythProof(deps: ReplayDeps, input: { market: string; which: number }): Promise<ReplayOutcome> {
  const step = await prepareReplay(deps, input);
  return step.kind === "claimed" ? postPreparedReplay(deps, step.prepared) : step;
}
