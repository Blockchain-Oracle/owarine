/**
 * Private mode (C8: `VenueCash` with `bucket = private`). Until it is on the participant: no desk (null), a zero
 * budget, no slot; a size needs the desk and the venue ladder, so it is not-live (D-015).
 */
import type { PrivateBudget, PrivateDeskState, PrivateQuote, PrivateSlot } from "@agari/core/private";
import type { Reading } from "@agari/core/schemas";
import type { Address, Hash32, MarketId, Side } from "@agari/core/types";
import { cantonNotLive } from "../stub/not-deployed";
import { absent, unavailableFor } from "../stub/product";

/** The reason every private read and write states until the private bucket lands (C8). */
export const PRIVATE_NOT_LIVE = cantonNotLive("private");
/** What a person reads when the route cannot run. */
export const PRIVATE_NOT_LIVE_WORDS = "Private mode is not live on this network yet";

/** What the budget allows now: the allowance, capped by the balance. Pure. */
export function toPrivateBudget(balanceBase: bigint, allowanceBase: bigint): PrivateBudget {
  return { balanceBase, allowanceBase, spendableBase: allowanceBase < balanceBase ? allowanceBase : balanceBase };
}

export const getPrivateDeskState = (): Promise<Reading<PrivateDeskState | null>> => absent(null);
export const getPrivateBudget = (_owner: Address): Promise<Reading<PrivateBudget>> => absent(toPrivateBudget(0n, 0n));
export const getPrivateSlot = (_slotId: Hash32): Promise<Reading<PrivateSlot | null>> => absent(null);
export const sizePrivateForStake = (_marketId: MarketId, _side: Side, _stakeBase: bigint): Promise<Reading<PrivateQuote>> => unavailableFor(PRIVATE_NOT_LIVE);
