/**
 * The auditor's recount rows (`audit_recounts`, schema-proofs.ts): written by `scripts/drive/recount.ts`, read by
 * `/stats`. Venue-level figures only; the report holds contract counts and reserve totals, never a user's rows.
 */
import type postgres from "postgres";
import { ensureSchema } from "./migrate";

type Sql = postgres.Sql;

export interface RecountRow {
  atMs: number;
  offset: number | null;
  ok: boolean;
  report: unknown;
}

export async function recordRecount(sql: Sql, row: RecountRow): Promise<void> {
  await ensureSchema();
  await sql`INSERT INTO audit_recounts (at_ms, ledger_offset, ok, report) VALUES (${row.atMs}, ${row.offset}, ${row.ok}, ${sql.json(row.report as postgres.JSONValue)})`;
}

export async function latestRecount(sql: Sql): Promise<RecountRow | null> {
  await ensureSchema();
  const [r] = await sql<{ at_ms: string; ledger_offset: string | null; ok: boolean; report: unknown }[]>`
    SELECT at_ms::text, ledger_offset::text, ok, report FROM audit_recounts ORDER BY at_ms DESC LIMIT 1`;
  return r ? { atMs: Number(r.at_ms), offset: r.ledger_offset === null ? null : Number(r.ledger_offset), ok: r.ok, report: r.report } : null;
}
