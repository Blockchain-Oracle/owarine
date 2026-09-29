/**
 * The Gap Series set (session-lanes.md §1.3): nine basis-1 Series on `LAUNCH_GRID`, one 256-node Book each, versions
 * from `policyVersions(symbol, sources, "gap")`. Lane 6a owns this file; `deploy/index.ts` re-exports all of it.
 *
 * Also the drive-only Gap Series (never in the core registry, so the app never lists them): 901, an attested primary for
 * the Surfpool time-travel drive, whose prints are labelled drive data; 902, TSLA's Pyth v1 Gap version for the overnight
 * devnet drive (Q-S6-3). And `openGapWindow`, the roller's Gap listing for drives (the cycle's `openWindow` is Regular-only).
 */
import { LAUNCH_TICKERS, TICKERS, type ScheduledWindow, type TickerSymbol } from "@agari/core/market";
import { GAP_CADENCE_SEC } from "@agari/core/types";
import type { Address } from "@agari/core/types";
import type { KeyPairSigner } from "./client";
import type { OpenedWindow } from "./cycle/window";
import { ADMIT_UNTIL_LOCK, asciiFeedId, I64_MAX, policyVersions, SOURCE, ZERO_POLICY, type PriceSources } from "./policies";
import { deployNotLive, type SendContext } from "./send";
import { BASIS, LAUNCH_GRID, type SeriesSpec } from "./venue-spec";

/** One recyclable Book per Gap Series: the previous weekend's Book is released at its lock (plan §3.3). */
export const GAP_BOOKS = { count: 1, capacity: 256 } as const;
/** Account sizes the dry run prices (events-accounts.md §3): a Series and a 256-node Book (`8 + 32,384 + 48 · 256`). */
export const SERIES_ACCOUNT_BYTES = 1_368;
export const GAP_BOOK_ACCOUNT_BYTES = 8 + 32_384 + 48 * GAP_BOOKS.capacity;

export const gapSeriesKey = (symbol: TickerSymbol) => `${symbol}-gap`;

/** The Gap Series of `symbols` (default: the nine launch tickers), record keys `TSLA-gap`. */
export function gapSeriesSpecs(sources: PriceSources, symbols: readonly TickerSymbol[] = LAUNCH_TICKERS): SeriesSpec[] {
  return symbols.map((symbol) => {
    if (!TICKERS[symbol].launch) throw new Error(`${symbol} is not a launch ticker`);
    return {
      key: gapSeriesKey(symbol), symbol, ticker: TICKERS[symbol].seriesId, cadenceSec: GAP_CADENCE_SEC, basis: BASIS.gap,
      params: LAUNCH_GRID, versions: policyVersions(symbol, sources, "gap"), books: { ...GAP_BOOKS },
    };
  });
}

export const DRIVE_GAP_ATTESTED_TICKER = 901;
export const DRIVE_GAP_PYTH_TICKER = 902;
export const DRIVE_GAP_ATTESTED_FEED = asciiFeedId("agari-drive-attested:TSLA-gap");

/** Series 901: attested primary (10 s correction delay, 60 s bars), open admission until the lock, no check; open-ended. */
export function driveGapAttestedSeries(sources: PriceSources): SeriesSpec {
  const tsla = policyVersions("TSLA", sources, "gap")[0]!;
  const primary = { ...ZERO_POLICY, source: SOURCE.attested, feedId: DRIVE_GAP_ATTESTED_FEED, minDelaySec: 10, barLenSec: 60, openAdmissionSec: ADMIT_UNTIL_LOCK, closeAdmissionSec: 900 };
  return {
    key: "TEST-ATT-gap", symbol: "TSLA", ticker: DRIVE_GAP_ATTESTED_TICKER, cadenceSec: GAP_CADENCE_SEC, basis: BASIS.gap, params: LAUNCH_GRID,
    versions: [{ validFromTs: tsla.validFromTs, validUntilTs: I64_MAX, primary, check: ZERO_POLICY, maxDivergenceBps: 0, checkAdmissionSec: 0 }],
    books: { ...GAP_BOOKS },
  };
}

/** Series 902: exactly TSLA's Gap v1 (Pyth primary until the lock, RedStone check), for a real-print overnight Window. */
export function driveGapPythSeries(sources: PriceSources): SeriesSpec {
  const v1 = policyVersions("TSLA", sources, "gap")[0]!;
  if (v1.primary.source !== SOURCE.pyth) throw new Error("price-sources.json: TSLA v1 is not Pyth");
  return { key: "TEST-PYTH-gap", symbol: "TSLA", ticker: DRIVE_GAP_PYTH_TICKER, cadenceSec: GAP_CADENCE_SEC, basis: BASIS.gap, params: LAUNCH_GRID, versions: [v1], books: { ...GAP_BOOKS } };
}

export type OpenedGapWindow = OpenedWindow & { lockAtSec: number };

/** Lists one Gap Window. On Canton a window opens through `Series_OpenWindow` (C3); not live in C1. */
export async function openGapWindow(_ctx: SendContext, _input: { roller: KeyPairSigner; series: Address; mint: Address; window: ScheduledWindow }): Promise<OpenedGapWindow> {
  throw deployNotLive();
}
