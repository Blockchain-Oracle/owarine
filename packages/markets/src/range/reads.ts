/**
 * The range reserve's reads (C8). Until the package is on the participant: no reserve (null), no rounds, no shares;
 * a preview, a quote or a capacity needs the reserve itself, so each is not-live (D-015).
 */
import type { RangeMode, RangeParams, RangeQuote, RangeReserveState, RangeRound } from "@agari/core/range";
import type { ProviderShares } from "@agari/core/reserves";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { absent, unavailableFor } from "../stub/product";
import type { RangeCapacity } from "./moonshot";
import { RANGE_NOT_LIVE, type RangeBand, type RangePreview, type RangeWindowBasis } from "./read";

export const getRangeReserveState = (): Promise<Reading<RangeReserveState | null>> => absent(null);
export const getRange = (_roundId: bigint): Promise<Reading<RangeRound | null>> => absent(null);
export const listRangesOf = (_wallet: Address): Promise<Reading<RangeRound[]>> => absent([]);
export const getRangeSharesOf = (_wallet: Address): Promise<Reading<ProviderShares>> => absent({ shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n });

export const previewRangeBasis = (_marketId: MarketId): Promise<Reading<RangeWindowBasis>> => unavailableFor(RANGE_NOT_LIVE);
export const previewRangeOpen = (_band: RangeBand, _maxPayoutBase: bigint): Promise<Reading<RangePreview>> => unavailableFor(RANGE_NOT_LIVE);
export const quoteRangeOnchain = (_band: RangeBand, _mode: RangeMode, _params: RangeParams, _tauSec: number): Promise<Reading<RangeQuote>> => unavailableFor(RANGE_NOT_LIVE);
export const readRangeCapacity = (_houseLockedBase: bigint, _expirySec: number): Promise<Reading<RangeCapacity>> => unavailableFor(RANGE_NOT_LIVE);
