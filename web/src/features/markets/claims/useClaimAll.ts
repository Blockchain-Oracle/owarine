"use client";

import type { TxOutcome } from "@agari/core/ports";
import type { ClaimableRow, Diagnosis } from "@agari/core/types";
import { diagnose, nowMs, type MarketsSubmitter } from "@agari/markets";
import { invalidateAfterWrite, useExitLegs, useSigner, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { IDLE_RUN, itemsFromRows } from "./claim-run";
import type { ClaimItem, ClaimRun } from "./types";

interface StepResult {
  patch: Partial<ClaimItem>;
  /** A refusal or an unresolved send stops the batch: one signing key is one writer, and a cancelled user is not re-prompted. */
  stop: boolean;
}

function stopWith(diag: Diagnosis, patch: Partial<ClaimItem> = {}): StepResult {
  return { patch: { status: "pending", diagnosis: diag, ...patch }, stop: true };
}

function fromOutcome(outcome: TxOutcome): StepResult {
  switch (outcome.status) {
    case "confirmed":
      return { patch: { status: "confirmed", txHash: outcome.txHash, diagnosis: null }, stop: false };
    case "reverted":
      return { patch: { status: "reverted", txHash: outcome.txHash ?? null, diagnosis: outcome.diagnosis }, stop: false };
    case "unknown":
      return { patch: { status: "unknown", txHash: outcome.txHash ?? null, diagnosis: outcome.diagnosis }, stop: true };
    case "refused":
      // The auto-payout got here first (D-032): the wallet has the money, so the item is settled and the batch goes on.
      if (outcome.diagnosis.kind === "already-claimed") return { patch: { status: "paid", txHash: null, diagnosis: null }, stop: false };
      return stopWith(outcome.diagnosis);
  }
}

/** A Window's exit on Canton (C4): a claim against its Resolution, or the stale refund when none came in time. */
export const exitModeOf = (item: Pick<ClaimItem, "kind">): "claim" | "refund" => (item.kind === "stale-refund" ? "refund" : "claim");

/**
 * One Window: the seat's legs exit through the legs routes (`exitLegs`). The claimables read already came from the
 * ledger with the Resolutions applied, and the route re-checks, so there is no separate settlement gate: a Window
 * without a Resolution past its `refundAfter` is refunded, never left stranded behind a "not settled" read.
 */
export async function redeemOne(submitter: MarketsSubmitter, item: ClaimItem): Promise<StepResult> {
  try {
    return fromOutcome(await submitter.exitLegs({ marketId: item.marketId, mode: exitModeOf(item) }));
  } catch (error) {
    return stopWith(diagnose(error));
  }
}

/**
 * Claim-all: one exit per Window (claim, or the stale refund), per-item outcomes, never one collapsed verdict (AD-15).
 * The sum the plate shows comes from the claimables reading, whose fee the port read at read time; the Epic 8
 * relayer re-reads settlementFeeBps at execution and must keep this surface's per-item contract unchanged.
 */
export function useClaimAll() {
  const submitter = useSubmitter();
  const exit = useExitLegs();
  const { address, hasSigner } = useSigner();
  const queryClient = useQueryClient();
  const [run, setRun] = useState<ClaimRun>(IDLE_RUN);
  const inFlight = useRef(false);

  const patchItem = useCallback((key: string, patch: Partial<ClaimItem>) => {
    setRun((current) => ({ ...current, items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) }));
  }, []);

  const claimAll = useCallback(
    async (rows: readonly ClaimableRow[]) => {
      const items = itemsFromRows(rows);
      if (!submitter || !address || inFlight.current || items.length === 0) return;
      inFlight.current = true;
      setRun({ status: "running", items, diagnosis: null, gasShort: false, finishedAtMs: null });

      // Gas is checked once before the first popup so an empty STT tank never strands a half-signed batch (FR-2).
      const gas = await submitter.checkGas("redeem");
      if (!gas.ok) {
        setRun((current) => ({ ...current, status: "done", diagnosis: gas.diagnosis, gasShort: gas.diagnosis.kind === "out-of-gas", finishedAtMs: nowMs() }));
        inFlight.current = false;
        return;
      }

      for (const item of items) {
        patchItem(item.key, { status: "claiming" });
        // One exit per Window through the seat's write scope (useExitLegs): no retries, journaled first.
        const result = await exit.mutateAsync({ marketId: item.marketId, mode: exitModeOf(item) }).then(fromOutcome, (error: unknown) => stopWith(diagnose(error)));
        patchItem(item.key, result.patch);
        if (result.patch.status === "confirmed" || result.patch.status === "paid") await invalidateAfterWrite(queryClient, { wallet: address, marketId: item.marketId });
        if (result.stop) {
          setRun((current) => ({ ...current, diagnosis: result.patch.diagnosis ?? null }));
          break;
        }
      }
      setRun((current) => ({ ...current, status: "done", finishedAtMs: nowMs() }));
      inFlight.current = false;
    },
    [address, exit, patchItem, queryClient, submitter],
  );

  const reset = useCallback(() => setRun(IDLE_RUN), []);

  return { run, claimAll, reset, hasSigner };
}
