/**
 * Boost's reserve (`LpShare`/`NavStatement` under `PM.Reserve`, C8). Until the package is on the participant there is
 * no reserve (null), no positions and no shares; a position's mark needs the reserve itself, so it is not-live.
 */
import type { LeverageMark, LeveragePosition, LeverageReserveState } from "@agari/core/leverage";
import type { ProviderShares } from "@agari/core/reserves";
import type { Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { absent, unavailableFor } from "../stub/product";
import { LEVERAGE_NOT_LIVE } from "./deployment";

const NO_SHARES: ProviderShares = { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n };

export const getLeverageReserveState = (): Promise<Reading<LeverageReserveState | null>> => absent(null);
export const getLeveragePosition = (_positionId: bigint): Promise<Reading<LeveragePosition | null>> => absent(null);
export const listLeveragePositionsOf = (_wallet: Address): Promise<Reading<LeveragePosition[]>> => absent([]);
export const listLeverageOpenPositions = (): Promise<Reading<LeveragePosition[]>> => absent([]);
export const getLeverageSharesOf = (_wallet: Address): Promise<Reading<ProviderShares>> => absent({ ...NO_SHARES });
export const getLeverageMark = (_positionId: bigint): Promise<Reading<LeverageMark>> => unavailableFor(LEVERAGE_NOT_LIVE);
