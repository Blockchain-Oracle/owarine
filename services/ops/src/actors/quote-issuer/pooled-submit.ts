/**
 * A venue write that consumes pool shards: submit, then hand the shards back to the pool by what the ledger said.
 * Landed → consumed shards leave and the created venue change joins free; definite rejection → shards free (or dropped
 * when the ledger names them inactive); timeout / 503 → quarantined under the command id until its completion is known.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import {
  activeOf, decodeVenueCash, inactiveCids, isInactive, isIndefinite, submit, templateSuffix,
  type Active, type RoleSession, type SubmitInput, type SubmitOutcome, type VenueCashC,
} from "@agari/markets/ops/canton";
import type { Lease, ShardPool } from "./pool";

const CASH = templateSuffix(TEMPLATE_IDS.VenueCash);

export function venueCashCreated(out: Extract<SubmitOutcome, { kind: "done" }>): Active<VenueCashC>[] {
  return out.created.filter((e) => templateSuffix(e.templateId) === CASH).map((e) => activeOf(e, decodeVenueCash));
}

/** Contract ids the transaction archived (consumed), from its ACS-delta events. */
export function archivedCids(out: Extract<SubmitOutcome, { kind: "done" }>): Set<string> {
  return new Set(out.transaction.events.flatMap((e) => ("ArchivedEvent" in e ? [e.ArchivedEvent.contractId] : [])));
}

export async function submitWithShards(pool: ShardPool, session: RoleSession, leases: readonly Lease[], input: SubmitInput): Promise<SubmitOutcome> {
  const beginOffset = await session.client.ledgerEnd().catch(() => undefined);
  try {
    const out = await submit(session, { ...(beginOffset === undefined ? {} : { beginOffset }), ...input });
    if (out.kind === "dry") pool.release(leases);
    // A recovered duplicate returns the ORIGINAL transaction: a shard leased for this retry that it did not consume goes back free.
    else pool.complete(leases, archivedCids(out), venueCashCreated(out));
    return out;
  } catch (error) {
    if (isIndefinite(error)) pool.quarantine(leases, input.commandId, beginOffset ?? 0);
    else pool.release(leases, isInactive(error) ? new Set(inactiveCids(error, leases.map((l) => l.cid))) : new Set());
    throw error;
  }
}

/**
 * Resolves quarantined shards: a completion for their command means it landed (the shard is gone); none after
 * `settleMs` means it did not, and the shard is free again. Called by the rebalancer's pass.
 */
export async function resolveQuarantine(pool: ShardPool, session: RoleSession, settleMs = 90_000): Promise<string | null> {
  const held = pool.quarantined();
  if (held.length === 0) return null;
  const notes: string[] = [];
  for (const s of held) {
    if (!s.commandId) continue;
    const done = await session.client.findAcceptedCompletion(s.commandId, [session.party], s.beginOffset ?? 0).catch(() => undefined);
    if (done) {
      pool.unquarantine(s.cid, true);
      notes.push(`${s.commandId} landed`);
    } else if (Date.now() - s.sinceMs > settleMs) {
      pool.unquarantine(s.cid, false);
      notes.push(`${s.commandId} never landed: shard freed`);
    }
  }
  return notes.length ? `quarantine: ${notes.join(", ")}` : null;
}
