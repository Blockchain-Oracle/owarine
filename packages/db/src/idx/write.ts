/**
 * The projector's writer: one DB transaction per ledger update holding the raw events, the projected rows and the
 * cursor (plan: "the cursor advances in the same DB transaction as the writes"). An update at or below the cursor, or
 * one already in `idx_updates`, is skipped whole, so a replay after a crash or a reconnect never duplicates a row.
 */
import type postgres from "postgres";
import { INDEX_TABLES } from "../schema-index";
import { applyFacts } from "./apply";
import { marketIdOfKey } from "./ids";
import type { IdxCursor, IdxUpdate } from "./types";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

/** `pg_advisory_xact_lock` class for the projector: one writer per stream at a time, across processes. */
const PROJECTOR_LOCK = 761_403_915_284_201n;

/** Offsets are int64 on the wire and in Postgres; the ledger client keeps them as safe JS integers. */
export function offsetOf(value: string | number | bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`offset out of range: ${String(value)}`);
  return n;
}

type CursorRow = { party: string; ledger_offset: string; update_id: string | null; bootstrap: "replay" | "acs"; history_from_offset: string };

const cursorOf = (stream: string, r: CursorRow): IdxCursor => ({
  stream,
  party: r.party,
  offset: offsetOf(r.ledger_offset),
  updateId: r.update_id,
  bootstrap: r.bootstrap,
  historyFromOffset: offsetOf(r.history_from_offset),
});

async function lockedCursor(tx: Tx, stream: string): Promise<IdxCursor | null> {
  await tx`SELECT pg_advisory_xact_lock(${PROJECTOR_LOCK.toString()}::bigint)`;
  const [row] = await tx<CursorRow[]>`
    SELECT party, ledger_offset::text, update_id, bootstrap, history_from_offset::text FROM idx_cursor WHERE stream = ${stream} FOR UPDATE`;
  return row ? cursorOf(stream, row) : null;
}

async function advance(tx: Tx, stream: string, party: string, offset: number, updateId: string | null, recordTimeMs: number | null): Promise<void> {
  await tx`
    INSERT INTO idx_cursor (stream, party, ledger_offset, update_id, updated_at_ms, record_time_ms)
    VALUES (${stream}, ${party}, ${offset}::bigint, ${updateId}, ${Date.now()}, ${recordTimeMs})
    ON CONFLICT (stream) DO UPDATE SET ledger_offset = EXCLUDED.ledger_offset, update_id = COALESCE(EXCLUDED.update_id, idx_cursor.update_id),
      updated_at_ms = EXCLUDED.updated_at_ms, record_time_ms = COALESCE(EXCLUDED.record_time_ms, idx_cursor.record_time_ms)
    WHERE idx_cursor.ledger_offset < EXCLUDED.ledger_offset`;
}

export type ApplyResult = "applied" | "skipped";

export function indexWriter(sql: Sql) {
  return {
    async cursor(stream: string): Promise<IdxCursor | null> {
      const [row] = await sql<CursorRow[]>`
        SELECT party, ledger_offset::text, update_id, bootstrap, history_from_offset::text FROM idx_cursor WHERE stream = ${stream}`;
      return row ? cursorOf(stream, row) : null;
    },

    /** Writes one update's events and rows and advances the cursor, all or nothing. */
    async applyUpdate(stream: string, party: string, u: IdxUpdate): Promise<ApplyResult> {
      return sql.begin(async (tx) => {
        const cursor = await lockedCursor(tx, stream);
        if (cursor && cursor.party !== party) throw new Error(`stream ${stream} projects ${cursor.party}, not ${party}: rebuild into a fresh database`);
        if (cursor && cursor.offset >= u.offset) return "skipped" as const;
        const inserted = await tx`
          INSERT INTO idx_updates (update_id, ledger_offset, record_time_ms, effective_at_ms, command_id, workflow_id, events, indexed_at_ms)
          VALUES (${u.updateId}, ${u.offset}::bigint, ${u.recordTimeMs}, ${u.effectiveAtMs}, ${u.commandId}, ${u.workflowId}, ${u.events.length}, ${Date.now()})
          ON CONFLICT DO NOTHING RETURNING 1`;
        if (inserted.length === 0) {
          await advance(tx, stream, party, u.offset, u.updateId, u.recordTimeMs);
          return "skipped" as const;
        }
        if (u.events.length > 0) {
          const tsSec = Math.floor(u.effectiveAtMs / 1000);
          const rows = u.events.map((e) => ({
            update_id: u.updateId, node_id: e.nodeId, ledger_offset: u.offset, kind: e.kind, template: e.template, package_name: e.packageName,
            contract_id: e.contractId, choice: e.choice, consuming: e.consuming, last_descendant: e.lastDescendant,
            market: e.marketKey ? marketIdOfKey(e.marketKey) : null, effective_at_sec: tsSec, data: tx.json((e.data ?? null) as postgres.JSONValue),
          }));
          for (let i = 0; i < rows.length; i += 500) await tx`INSERT INTO idx_events ${tx(rows.slice(i, i + 500))}`;
        }
        await applyFacts(tx, u, party);
        await advance(tx, stream, party, u.offset, u.updateId, u.recordTimeMs);
        return "applied" as const;
      });
    },

    /** An `OffsetCheckpoint`: nothing to write, but the cursor moves so a restart does not re-read an idle stretch. */
    async applyCheckpoint(stream: string, party: string, offset: number, recordTimeMs: number | null): Promise<void> {
      await sql.begin(async (tx) => {
        const cursor = await lockedCursor(tx, stream);
        if (cursor && cursor.party !== party) throw new Error(`stream ${stream} projects ${cursor.party}, not ${party}`);
        await advance(tx, stream, party, offset, null, recordTimeMs);
      });
    },

    /** Marks the stream as bootstrapped from an ACS snapshot at `offset` (pruned participant): history before it is not indexed. */
    async markAcsBootstrap(stream: string, party: string, offset: number): Promise<void> {
      await sql`
        INSERT INTO idx_cursor (stream, party, ledger_offset, updated_at_ms, bootstrap, history_from_offset)
        VALUES (${stream}, ${party}, ${offset}::bigint, ${Date.now()}, 'acs', ${offset}::bigint)
        ON CONFLICT (stream) DO UPDATE SET bootstrap = 'acs', history_from_offset = EXCLUDED.history_from_offset`;
    },

    /** Empties every projection table (a full rebuild replays from the ledger). */
    async truncate(): Promise<void> {
      await sql.unsafe(`TRUNCATE ${INDEX_TABLES.join(", ")}`);
    },
  };
}

export type IndexWriter = ReturnType<typeof indexWriter>;
