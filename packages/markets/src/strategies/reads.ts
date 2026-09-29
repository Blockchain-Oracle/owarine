/**
 * The strategy registry (C8). Until the package is on the participant there is no registry: `null` inside the
 * reading (not an error), and no subscriptions (D-015).
 */
import type { Reading } from "@agari/core/schemas";
import type { StrategyRecord, StrategySubscription } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { cantonNotLive } from "../stub/not-deployed";
import { absent } from "../stub/product";

/** The reason every registry write states until C8. */
export const STRATEGIES_NOT_LIVE = cantonNotLive("strategies");

/** Every sealed strategy. `null` inside the reading where no registry exists on this participant. */
export const listStrategies = (): Promise<Reading<StrategyRecord[] | null>> => absent(null);
export const getStrategy = (_strategyId: bigint): Promise<Reading<StrategyRecord | null>> => absent(null);
export const listSubscriptionsOf = (_wallet: Address, _strategyIds: readonly bigint[]): Promise<Reading<StrategySubscription[]>> => absent([]);
export const listLiveSubscribers = (_strategyId: bigint): Promise<Reading<StrategySubscription[]>> => absent([]);
/** Everyone who ever subscribed: nobody, with no registry. */
export async function listStrategySubscribers(_strategyId: bigint): Promise<Address[]> {
  return [];
}
