/**
 * The token Series set (session-lanes.md §2.4): TSLAx/NVDAx/SPYx/QQQx × 300/900/3,600, basis 2, two 256-node Books each,
 * on `LAUNCH_GRID`, with the token versions of `tokenPolicyVersions`. Lane 6b owns this file; `deploy/index.ts`
 * re-exports all of it.
 */
import { laneKey, TICKERS, TOKEN_LANE_TICKERS, type TickerSymbol } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import type { DeployClient } from "./client";
import type { PriceSources } from "./policies";
import { tokenPolicyVersions } from "./policies-token";
import { deployNotLive, type StepContext } from "./send";
import { BASIS, LAUNCH_GRID, type SeriesSpec } from "./venue-spec";

export const TOKEN_CADENCES = [300, 900, 3_600] as const;
export const TOKEN_BOOKS = { count: 2, capacity: 256 } as const;
/** Switchboard's default devnet queue (spike (a), D-053); pinned on chain by `admin_set_authorities`. */
export const SWITCHBOARD_DEVNET_QUEUE_ADDRESS = "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7" as Address;

/** Every token Series of `symbols` × `cadences`; throws while any feed hash is unpinned. */
export function tokenSeries(sources: PriceSources, symbols: readonly TickerSymbol[] = TOKEN_LANE_TICKERS, cadences: readonly number[] = TOKEN_CADENCES): SeriesSpec[] {
  return symbols.flatMap((symbol) => {
    if (!TICKERS[symbol].xstock) throw new Error(`${symbol} has no xStock token lane`);
    const versions = tokenPolicyVersions(symbol, sources);
    return cadences.map((cadenceSec) => ({
      key: laneKey(symbol, "token", cadenceSec),
      symbol,
      ticker: TICKERS[symbol].seriesId,
      cadenceSec,
      basis: BASIS.token,
      params: LAUNCH_GRID,
      versions,
      books: { ...TOKEN_BOOKS },
    }));
  });
}

export type SwitchboardPin = { queue: Address | null; minOracles: number; treasury: Address };

/** The venue's Switchboard pin. Switchboard is not a Canton source; not live in C1. */
export async function readSwitchboardPin(_client: DeployClient): Promise<SwitchboardPin> {
  throw deployNotLive();
}

export async function pinSwitchboardQueue(_ctx: StepContext, _queue: Address, _minOracles: number): Promise<string | null> {
  throw deployNotLive();
}
