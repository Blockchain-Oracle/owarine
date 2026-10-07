"use client";

import { isOk } from "@owarine/core/schemas";
import type { Address, Signature } from "@owarine/core/types";
import { useCreatorPayouts } from "@owarine/markets/react";
import { useCallback, useState } from "react";
import type { DeskBusy, DeskWriteResult } from "./useDeskWrites";

export interface CreatorFeesModel {
  /** The waiting total in base units, or null while unread or unreadable. */
  waitingBase: bigint | null;
  feeCount: number;
  readable: boolean;
  claiming: boolean;
  /** The last claim's answer on this screen: what was claimed and its update id, or why it was not. */
  last: { ok: true; amountBase: bigint; txHash: Signature | null } | { ok: false; reason: string } | null;
  claim: () => Promise<void>;
}

/**
 * A creator's fees on its own strategy's desk (C8i), shared by web and the phone: the venue's pooled payouts waiting
 * for the seat, and one claim of them all into the seat. Read only when the seat created the selected strategy.
 */
export function useCreatorFees(writes: { address: string | null; busy: DeskBusy; claimFees: () => Promise<DeskWriteResult> }, isCreator: boolean): CreatorFeesModel {
  const reading = useCreatorPayouts(writes.address as Address | null, isCreator);
  const value = reading && isOk(reading) && !reading.stale ? reading.value : null;
  const [last, setLast] = useState<CreatorFeesModel["last"]>(null);
  const { claimFees } = writes;
  const waitingBase = value?.totalBase ?? null;
  const claim = useCallback(async () => {
    const amountBase = waitingBase ?? 0n;
    const r = await claimFees();
    setLast(r.ok ? { ok: true, amountBase, txHash: r.txHash ?? null } : { ok: false, reason: r.reason ?? "the claim did not land" });
  }, [claimFees, waitingBase]);
  return { waitingBase, feeCount: value?.feeCount ?? 0, readable: value !== null, claiming: writes.busy === "claim", last, claim };
}
