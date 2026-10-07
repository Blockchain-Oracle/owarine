"use client";

import { ONCHAIN_POLL_MS } from "@owarine/core/constants";
import type { Address, MarketId } from "@owarine/core/types";
import { getRedemption, type Redemption } from "@owarine/markets";
import { keys, useReadingQuery } from "@owarine/markets/react";

export type { Redemption } from "@owarine/markets";

/**
 * How a won Window's payout reached the wallet once nothing is left to claim: the wallet's own redeem, or the
 * venue paying it automatically. Nested under the wallet's positions, so the claim that empties a seat refreshes it.
 * An index that lags a few seconds answers null first; the verdict then says "Paid to your wallet" until it lands.
 */
export function useRedemption(wallet: Address | null, marketId: MarketId, enabled: boolean): Redemption | null {
  const reading = useReadingQuery([...keys.positions(wallet), "redemption", marketId], () => getRedemption(wallet as Address, marketId), {
    enabled: enabled && wallet !== null,
    pollMs: (latest) => (latest?.ok && latest.value ? false : ONCHAIN_POLL_MS),
    needs: [],
  });
  return reading?.ok ? reading.value : null;
}
