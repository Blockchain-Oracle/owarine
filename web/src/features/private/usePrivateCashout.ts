"use client";

import { privateRequestId, type PrivateCashoutResult, type PrivatePosition } from "@owarine/core/private";
import type { Address } from "@owarine/core/types";
import { formatBaseUnits } from "@owarine/core/units";
import { ledgerBase, seatAuthHeaders } from "@owarine/markets";
import { invalidateAfterWrite } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { PRIVATE } from "./copy";

/**
 * Cash out one settled private call (C8d): the seat names it, the route brings its payout home into the private bucket
 * and dismisses its receipt in one transaction. The reply says where the money went; the list re-reads the ledger.
 */
export function usePrivateCashout(refresh: () => void, decimals: number, symbol: string) {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const cashOut = useCallback(
    async (position: PrivatePosition): Promise<PrivateCashoutResult | null> => {
      setBusySlot(position.pairId);
      try {
        const url = `${ledgerBase(true)}/private/cashout`;
        const body = JSON.stringify({ commandId: privateRequestId(), pairId: position.pairId, marketId: position.marketId });
        const res = await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json", ...(await seatAuthHeaders({ method: "POST", url, body })) }, body });
        const json = (await res.json().catch(() => null)) as (PrivateCashoutResult & { error?: string }) | { error?: string } | null;
        if (!res.ok || !json || !("status" in json)) {
          notify.warning(PRIVATE.claims.cashOut, (json && "error" in json && json.error) || `private route answered ${res.status}`);
          return null;
        }
        if (json.status === "open") notify.neutral(PRIVATE.toasts.stillOpen);
        else if (json.status === "credited") {
          const payout = BigInt(json.payoutBase);
          notify.neutral(payout > 0n ? PRIVATE.toasts.cashedOut(formatBaseUnits(payout, decimals), symbol) : PRIVATE.toasts.lost);
        } else notify.neutral(PRIVATE.toasts.alreadyHome);
        refresh();
        if (address) await invalidateAfterWrite(queryClient, { wallet: address as Address });
        return json;
      } finally {
        setBusySlot(null);
      }
    },
    [address, queryClient, refresh, decimals, symbol],
  );

  return { cashOut, busySlot };
}
