/**
 * Check results as `docs/plan/acceptance.md` rows (C2y). Every DevNet check and every write the bootstrap sends
 * prints one, failures included, so the ledger's evidence is pasted, not retyped:
 *   | UTC | Stage | Scenario | Parity rows | Commit | Ledger evidence (update id / trace id / artifact) | Result |
 * Nothing here may carry a secret or a full party id: callers pass hints (`shortParty`) and trace ids only.
 */
import { LedgerError } from "@owarine/ledger";

export type Outcome = "pass" | "fail" | "warn" | "skip";

export interface CheckRow {
  check: string;
  outcome: Outcome;
  /** One line, no secrets, no full party ids. */
  detail: string;
  /** Update id, trace id, endpoint or artifact. */
  evidence?: string;
}

/** A failed call's evidence: Noders answers errors with a trace id only (s3-materials-update, "Debugging"). */
export function errorEvidence(e: unknown): { detail: string; evidence: string } {
  if (e instanceof LedgerError) {
    const status = e.status === undefined ? e.kind : `HTTP ${e.status}`;
    return { detail: `${status}${e.code ? ` ${e.code}` : ""}: ${e.message.split("\n")[0]!.slice(0, 160)}`, evidence: e.traceId ? `trace id ${e.traceId}` : e.path };
  }
  return { detail: e instanceof Error ? e.message.split("\n")[0]!.slice(0, 160) : String(e), evidence: "—" };
}

const cell = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");

export function acceptanceRow(r: CheckRow, o: { stage: string; commit: string; atIso: string; prefix?: string }): string {
  const result = r.outcome === "pass" ? `pass: ${r.detail}` : r.outcome === "fail" ? `fail: ${r.detail}` : r.outcome === "warn" ? `pass with a note: ${r.detail}` : `not run: ${r.detail}`;
  return `| ${o.atIso} | ${o.stage} | ${cell(`${o.prefix ?? ""}${r.check}`)} | — | ${o.commit} | ${cell(r.evidence ?? "—")} | ${cell(result)} |`;
}

/** A fixed-width table for the terminal. */
export function table(rows: readonly CheckRow[]): string {
  const w = Math.max(5, ...rows.map((r) => r.check.length));
  const mark: Record<Outcome, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
  return rows.map((r) => `${mark[r.outcome]}  ${r.check.padEnd(w)}  ${r.detail}${r.evidence && r.outcome === "fail" ? `  [${r.evidence}]` : ""}`).join("\n");
}

export const failed = (rows: readonly CheckRow[]) => rows.some((r) => r.outcome === "fail");
