"use client";

import { isOk, type Reading } from "@owarine/core/schemas";
import type { Address, BalanceSheet } from "@owarine/core/types";
import { keys, useBalanceSheet } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { useVenue } from "../useVenue";

export type BalancePlateState =
  | { kind: "disconnected"; symbol: string | null }
  | { kind: "connected"; address: Address; symbol: string | null; reading: Reading<BalanceSheet> | null; retry: () => void };

/** Balance sheet for the connected wallet; the collateral symbol comes from the boot read, never a guessed ticker. */
export function useBalancePlate(): BalancePlateState {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : null;
  const reading = useBalanceSheet(address);
  const queryClient = useQueryClient();
  const retry = useCallback(() => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.balanceSheet(address) });
  }, [address, queryClient]);

  // C4f: the seat route refusing this key (its holder reset the seat, its lease ended) means every read keyed by this
  // address belongs to a seat it no longer holds: re-read them all now, so the record, bets and claims of the gone seat
  // leave the screen with its balance instead of waiting for their own polls (history polls every five minutes).
  const refused = reading !== null && !reading.ok && reading.error.kind === "signer-required";
  useEffect(() => {
    if (refused && address) void queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes(address) });
  }, [refused, address, queryClient]);

  if (!address) return { kind: "disconnected", symbol };
  return { kind: "connected", address, symbol, reading, retry };
}
