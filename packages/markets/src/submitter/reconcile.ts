import type { IntentRecord } from "@owarine/core/ports";
import type { Address, MarketId } from "@owarine/core/types";
import { msToSec } from "@owarine/core/units";
import type { WriteEvidence } from "./evidence";
import type { WriteRpc } from "./write-rpc";

export type ReconcileVerdict = "confirmed" | "reverted" | "absent" | "unknown";

export interface ReconcileDeps {
  rpc?: WriteRpc;
  evidence: WriteEvidence;
  nowMs: () => number;
}

/** A write closed before it had an update id may still have been submitted; after this, it can't complete. */
export const UNSIGNED_SETTLE_MS = 120_000;

/**
 * With an update id the ledger decides: C4 looks the update up (or reads the command's completion). Until then the
 * honest answer is `unknown`, which leaves the record open and never re-sends it (AD-3).
 */
async function byUpdateId(): Promise<ReconcileVerdict> {
  return "unknown";
}

/** Without an update id: an order is confirmed by any fill on its Window since it was recorded, a claim by its record. */
async function byRecord(wallet: Address, record: IntentRecord, deps: ReconcileDeps): Promise<ReconcileVerdict> {
  if (deps.nowMs() - record.createdAtMs < UNSIGNED_SETTLE_MS || !record.marketId) return "unknown";
  if (record.kind === "order") {
    const filled = await deps.evidence.filledSince(wallet, record.marketId, msToSec(record.createdAtMs));
    return filled === null ? "unknown" : filled ? "confirmed" : "absent";
  }
  if (record.kind === "redeem") {
    const paidBy = await deps.evidence.redeemedBy(wallet, record.marketId as MarketId, (record.pool ?? record.marketId) as Address);
    // Paid by the venue's settle is not this intent landing, but the claim it stood for is done either way.
    return paidBy ? "confirmed" : "unknown";
  }
  return "unknown";
}

/**
 * A send that timed out, or a tab closed mid-send, is never re-signed or re-sent (AD-3): the ledger and the projection
 * are asked what happened (first-call.md §3.4, D-033).
 */
export async function reconcileUnknown(wallet: Address, record: IntentRecord, deps: ReconcileDeps): Promise<ReconcileVerdict> {
  if (record.txHash) return byUpdateId();
  return byRecord(wallet, record, deps);
}
