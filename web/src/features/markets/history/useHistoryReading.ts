"use client";

import type { WalletHistory } from "@owarine/core/projection";
import type { Reading } from "@owarine/core/schemas";
import type { Address } from "@owarine/core/types";
import { keys, useWalletHistory } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWalletSession } from "@/lib/wallet-session";

export interface HistoryReading {
  address: Address | null;
  reading: Reading<WalletHistory> | null;
  retry: () => void;
}

/**
 * The connected wallet's projection plus the retry every boundary hands its error state.
 *
 * `enabled` is how the Portfolio holds this back: it is the page's most expensive read, and
 * starting it alongside the balance and the open positions meant the numbers a portfolio is
 * opened for queued behind a multi-page fill scan.
 */
export function useHistoryReading(enabled = true): HistoryReading {
  const { address } = useWalletSession();
  const reading = useWalletHistory(address, enabled);
  const queryClient = useQueryClient();
  const retry = useCallback(() => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.history(address) });
  }, [address, queryClient]);
  return { address, reading, retry };
}
