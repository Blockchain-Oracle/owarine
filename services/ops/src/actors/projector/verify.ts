/**
 * `verify-projection` (research 02 map item 12): an independent recount. It re-reads the venue's active contracts at
 * the projection's cursor offset (`iterateActiveContracts`, nothing taken from the stream) and diffs, template by
 * template, the contract ids the ledger says are live against the ones the projection's rows say are live. It also runs
 * the projection's own consistency checks (counters against the rows they count, duplicate keys).
 */
import { projectedLiveSets, projectionInvariants, readIdxCursor, VERIFIED_TEMPLATES, type Db, type VerifiedTemplate } from "@owarine/db";
import type { LedgerClient } from "@owarine/ledger";
import { PM_PACKAGE_NAME, templateName } from "./decode";

export interface VerifyReport {
  ok: boolean;
  offset: number | null;
  ledger: Record<string, number>;
  projection: Record<string, number>;
  mismatches: string[];
}

const sample = (ids: string[]) => ids.slice(0, 3).map((id) => `${id.slice(0, 12)}…`).join(", ");

export async function verifyProjection(o: { db: Db; ledger: LedgerClient; party: string; stream?: string }): Promise<VerifyReport> {
  // The cursor, the live rows and the invariants from one snapshot: the projector keeps writing while the ledger is
  // paged, and rows read after it moved on would show its newest contracts as mismatches (8 Oct, hosted recount).
  const { cursor, projected, invariants } = await o.db.begin("isolation level repeatable read read only", async (tx) => ({
    cursor: await readIdxCursor(tx, o.stream ?? "venue"),
    projected: await projectedLiveSets(tx),
    invariants: await projectionInvariants(tx),
  }));
  if (!cursor) return { ok: false, offset: null, ledger: {}, projection: {}, mismatches: ["no cursor: the projection is empty"] };
  if (cursor.party !== o.party) return { ok: false, offset: cursor.offset, ledger: {}, projection: {}, mismatches: [`projection holds ${cursor.party}, not ${o.party}`] };

  const onLedger = new Map<VerifiedTemplate, Set<string>>(VERIFIED_TEMPLATES.map((t) => [t, new Set<string>()]));
  for await (const page of o.ledger.iterateActiveContracts({ parties: [o.party], activeAtOffset: cursor.offset, maxPageSize: 500 })) {
    for (const c of page.contracts) {
      if (c.createdEvent.packageName !== PM_PACKAGE_NAME) continue;
      onLedger.get(templateName(c.createdEvent.templateId) as VerifiedTemplate)?.add(c.createdEvent.contractId);
    }
  }

  const mismatches: string[] = [];
  const ledger: Record<string, number> = {};
  const projection: Record<string, number> = {};
  for (const t of VERIFIED_TEMPLATES) {
    const l = onLedger.get(t)!;
    const p = projected[t];
    ledger[t] = l.size;
    projection[t] = p.size;
    // MarketTerms and Resolution are never archived by the model, so both sides list every one ever created.
    const missing = [...l].filter((id) => !p.has(id));
    const extra = [...p].filter((id) => !l.has(id));
    if (missing.length) mismatches.push(`${t}: ${missing.length} live on the ledger, not in the projection (${sample(missing)})`);
    if (extra.length) mismatches.push(`${t}: ${extra.length} live in the projection, not on the ledger (${sample(extra)})`);
  }
  mismatches.push(...invariants);
  return { ok: mismatches.length === 0, offset: cursor.offset, ledger, projection, mismatches };
}
