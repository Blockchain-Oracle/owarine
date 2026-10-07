/**
 * Who archived a transfer instruction the venue sent (C7b): the owner accepting it, or rejecting it. Daml cannot see an
 * archived contract, so the venue's ops reads the ledger's history for the exercise that consumed it, from the offset
 * the withdrawal receipt was created at. Written from the JSON Ledger API spec (`POST /v2/updates`, LEDGER_EFFECTS shape),
 * exercised only against a fake in tests: no node is contacted in this lane.
 *
 * Only `TransferInstruction_Accept` and `TransferInstruction_Reject` count. A withdraw by the venue is the venue's own
 * refund and is recorded by that command's own receipt, so a gone instruction that neither exercise explains stays
 * `unknown` and the planner waits rather than guessing.
 */
import type { JsTransaction, JsUpdateEnvelope, LedgerClient, Party } from "@owarine/ledger";

export type ArchiveKind = "accepted" | "rejected";

export interface HistoryConfig {
  client: Pick<LedgerClient, "http">;
  venue: Party;
  /** Updates read per request; the scan continues from the last offset until a page is short. */
  pageSize?: number;
  /** A bound on pages scanned per call, so a stale receipt cannot make one pass read the whole ledger. */
  maxPages?: number;
}

/** Scan from `beginExclusive` and answer, for each cid found consumed by an Accept or a Reject, which one it was. */
export async function archivedByExercise(cfg: HistoryConfig, cids: readonly string[], beginExclusive: number): Promise<Map<string, ArchiveKind>> {
  const want = new Set(cids);
  const found = new Map<string, ArchiveKind>();
  if (want.size === 0) return found;
  const limit = cfg.pageSize ?? 200;
  let begin = beginExclusive;
  for (let page = 0; page < (cfg.maxPages ?? 20); page += 1) {
    const rows = await cfg.client.http.request<JsUpdateEnvelope[]>("POST", "/v2/updates", {
      query: { limit, stream_idle_timeout_ms: 1_000 },
      json: {
        beginExclusive: begin,
        updateFormat: {
          includeTransactions: {
            transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
            eventFormat: { filtersByParty: { [cfg.venue]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] } }, verbose: true },
          },
        },
      },
    });
    let last = begin;
    let transactions = 0;
    for (const row of rows) {
      const u = row.update;
      if (u && "Transaction" in u) {
        transactions += 1;
        const tx: JsTransaction = u.Transaction.value;
        last = Math.max(last, tx.offset);
        for (const e of tx.events) {
          if (!("ExercisedEvent" in e)) continue;
          const x = e.ExercisedEvent;
          if (!want.has(x.contractId) || !x.consuming) continue;
          if (x.choice === "TransferInstruction_Accept") found.set(x.contractId, "accepted");
          else if (x.choice === "TransferInstruction_Reject") found.set(x.contractId, "rejected");
        }
      } else if (u && "OffsetCheckpoint" in u) {
        last = Math.max(last, u.OffsetCheckpoint.value.offset);
      }
    }
    if (found.size === want.size || transactions < limit || last === begin) break;
    begin = last;
  }
  return found;
}
