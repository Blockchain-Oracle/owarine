/**
 * The drive-only "owned" windows (never in the core registry): their Series specs are pure and kept; opening, quoting
 * and closing them are ledger steps (`products.ts`, not live in C1).
 */
import type { Address } from "@agari/core/types";
import type { KeyPairSigner } from "./client";
import { asciiFeedId, I64_MAX, policyVersions, SOURCE, ZERO_POLICY, type PriceSources } from "./policies";
import { BASIS, LAUNCH_GRID, type SeriesSpec } from "./venue-spec";

export const DRIVE_OWNED_TICKERS = [903, 904, 905] as const;
export type OwnedLane = 0 | 1 | 2;
const LANE_KEYS = ["TEST-OWNED-15m", "TEST-OWNED-B", "TEST-OWNED-C"] as const;
export const DRIVE_OWNED_FEED = asciiFeedId("agari-drive-attested:owned");
const CADENCE_SEC = 900;
const BAR_LEN_SEC = 60;
const MIN_DELAY_SEC = 10;

export function driveOwnedSeries(sources: PriceSources, lane: OwnedLane = 0): SeriesSpec {
  const tsla = policyVersions("TSLA", sources)[0]!;
  const primary = { ...ZERO_POLICY, source: SOURCE.attested, feedId: DRIVE_OWNED_FEED, minDelaySec: MIN_DELAY_SEC, barLenSec: BAR_LEN_SEC, openAdmissionSec: 900, closeAdmissionSec: 900 };
  return {
    key: LANE_KEYS[lane], symbol: "TSLA", ticker: DRIVE_OWNED_TICKERS[lane], cadenceSec: CADENCE_SEC, basis: BASIS.regular, params: LAUNCH_GRID,
    versions: [{ validFromTs: tsla.validFromTs, validUntilTs: I64_MAX, primary, check: ZERO_POLICY, maxDivergenceBps: 0, checkAdmissionSec: 0 }],
    books: { count: 1, capacity: 256 },
  };
}

export interface OwnedWindowKeys {
  roller: KeyPairSigner;
  attestor: KeyPairSigner;
  clusterTag: number;
  mint: Address;
}

export interface OwnedQuote {
  bidTicks: number;
  askTicks: number;
  lots: bigint;
}
