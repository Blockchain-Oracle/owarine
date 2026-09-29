/** Earn on Canton is the liquidity provider's reserve (C8). Until it lands: empty reads; the ladder top needs the venue (C4). */
import type { MakerWindowView } from "@agari/core/maker";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { notDeployedError } from "../stub/not-deployed";
import { absent } from "../stub/product";
import { MAKER_NOT_LIVE } from "./reads";

/** The best level a side, the depth over the first levels, and the grid, in raw units. */
export interface PoolTop {
  bestBidRaw: bigint | null;
  bestAskRaw: bigint | null;
  bidDepthRaw: bigint;
  askDepthRaw: bigint;
  tickRaw: bigint;
  lotRaw: bigint;
  minQuantityRaw: bigint;
}

export { getMakerSharesOf, getMakerVaultState, getMakerWindow, resolveMakerDeployment } from "./reads";
export { submitMakerTx } from "./writes";
export const listMakerOpenWindows = (): Promise<Reading<MakerWindowView[]>> => absent([]);
export const listMakerHistory = (_limit = 20, _offset = 0): Promise<Reading<MakerWindowView[]>> => absent([]);
export const getMakerUnsettledExpired = (): Promise<Reading<MarketId | null>> => absent(null);

/**
 * The top of one Window's published venue price ladder, in YES terms. The ladder is the venue's (C4); until then this
 * plain-promise read rejects with the not-live reading rather than report an empty book as depth.
 */
export async function readPoolTop(_bookAddress: Address, _levels = 5): Promise<PoolTop> {
  throw notDeployedError(MAKER_NOT_LIVE);
}
