"use client";

import type { OrderOutcome, OrderRequest, PhaseListener, TxOutcome } from "@agari/core/ports";
import type { Address, MarketId } from "@agari/core/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateAfterWrite } from "./invalidate";
import { useUserSession } from "./session";

/** Every write of one seat shares this scope, so TanStack runs them one at a time (plan "Performance and libraries"). */
export const seatScope = (address: Address | null) => ({ id: `seat:${address ?? "none"}` });

export interface PlaceOrderVariables {
  request: Omit<OrderRequest, "wallet">;
  onPhase?: PhaseListener;
}

/**
 * Place a call through the seat lane (firm quote → journal → accept). No retries: a mutation that failed is never
 * re-sent by the cache; idempotency comes from the journaled commandId, and recovery asks the ledger instead.
 */
export function usePlaceOrder() {
  const session = useUserSession();
  const queryClient = useQueryClient();
  const address = session?.address ?? null;
  return useMutation<OrderOutcome, Error, PlaceOrderVariables>({
    mutationKey: ["agari", "markets", "place-order", address],
    scope: seatScope(address),
    retry: 0,
    mutationFn: async ({ request, onPhase }) => {
      if (!session) return { status: "refused", diagnosis: { kind: "signer-required", retryable: false, technical: "no seat session" } };
      return session.submitter.submitOrder({ ...request, wallet: session.address }, onPhase);
    },
    onSettled: async (outcome, _error, { request }) => {
      if (session && outcome && (outcome.status === "confirmed" || outcome.status === "unknown")) {
        await invalidateAfterWrite(queryClient, { wallet: session.address, marketId: request.market.marketId });
      }
    },
  });
}

export interface ExitLegsVariables {
  marketId: MarketId;
  mode: "claim" | "refund";
  onPhase?: PhaseListener;
}

/** One tap claims a resolved Window's legs, or takes the stale refund; same seat scope, no retries. */
export function useExitLegs() {
  const session = useUserSession();
  const queryClient = useQueryClient();
  const address = session?.address ?? null;
  return useMutation<TxOutcome, Error, ExitLegsVariables>({
    mutationKey: ["agari", "markets", "exit-legs", address],
    scope: seatScope(address),
    retry: 0,
    mutationFn: async ({ marketId, mode, onPhase }) => {
      if (!session) return { status: "refused", diagnosis: { kind: "signer-required", retryable: false, technical: "no seat session" } };
      return session.submitter.exitLegs({ marketId, mode }, onPhase);
    },
    onSettled: async (outcome, _error, { marketId }) => {
      if (session && outcome && outcome.status !== "refused") await invalidateAfterWrite(queryClient, { wallet: session.address, marketId });
    },
  });
}
