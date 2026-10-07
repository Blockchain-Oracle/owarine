import type { IntentJournal, IntentRecord } from "@owarine/core/ports";
import type { Address } from "@owarine/core/types";
import { indexEvidence } from "./evidence";
import { reconcileUnknown, type ReconcileDeps, type ReconcileVerdict } from "./reconcile";

/**
 * Recovery of writes the journal still holds open — a send that timed out, a tab closed
 * between the wallet popup and the receipt. Run once when a session opens.
 *
 * AD-3, kept strictly: nothing here re-sends. A record moves only on the ledger's answer
 * (confirmed, reverted, absent), or when it has waited so long that no answer can be expected
 * and holding it open would keep a reservation and a "still checking" note alive forever.
 */
export const UNVERIFIABLE_AFTER_MS = 24 * 60 * 60 * 1000;

export const RECOVERY_REASON = {
  absent: "reconciled: not on the ledger",
  reverted: "reconciled: rejected by the ledger",
  expired: "reconciled: unverifiable after 24h",
} as const;

export type RecoveryOutcome = "landed" | "reverted" | "absent" | "expired" | "pending" | "error";

export interface RecoveryResult {
  record: IntentRecord;
  outcome: RecoveryOutcome;
  error?: unknown;
}

export type Reconciler = (wallet: Address, record: IntentRecord) => Promise<ReconcileVerdict>;

/** A reconciler over explicit ledger and projection access (scripts, ops, the drive). */
export const chainReconcilerWith =
  (deps: ReconcileDeps): Reconciler =>
  (wallet, record) =>
    reconcileUnknown(wallet, record, deps);

/** The ledger reconciler: the update's outcome when there is an update id, the Window's fills or claim when there is not. */
export const chainReconciler: Reconciler = (wallet, record) => reconcileUnknown(wallet, record, { evidence: indexEvidence(), nowMs: Date.now });

async function recoverOne(journal: IntentJournal, wallet: Address, record: IntentRecord, reconcile: Reconciler, nowMs: number): Promise<RecoveryResult> {
  let verdict: ReconcileVerdict;
  try {
    verdict = await reconcile(wallet, record);
  } catch (error) {
    return { record, outcome: "error", error };
  }
  if (verdict === "confirmed") {
    await journal.markConfirmed(record.id);
    return { record, outcome: "landed" };
  }
  if (verdict === "reverted") {
    await journal.markFailed(record.id, RECOVERY_REASON.reverted);
    return { record, outcome: "reverted" };
  }
  if (verdict === "absent") {
    await journal.markFailed(record.id, RECOVERY_REASON.absent);
    return { record, outcome: "absent" };
  }
  if (nowMs - record.createdAtMs > UNVERIFIABLE_AFTER_MS) {
    await journal.markFailed(record.id, RECOVERY_REASON.expired);
    return { record, outcome: "expired" };
  }
  return { record, outcome: "pending" };
}

/** Every unresolved record of the wallet, each asked about in turn; a reconcile that throws leaves its record untouched. */
export async function recoverUnresolved(journal: IntentJournal, wallet: Address, reconcile: Reconciler, nowMs: number): Promise<RecoveryResult[]> {
  const records = await journal.listUnresolved(wallet);
  const results: RecoveryResult[] = [];
  for (const record of records) results.push(await recoverOne(journal, wallet, record, reconcile, nowMs));
  return results;
}
