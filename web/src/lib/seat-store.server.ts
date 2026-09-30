import { recycleDrainingSeat, SEAT_RECYCLE_COLUMNS_SQL, seatLeaseRowFor, type Db, type RecycleCheck, type RecycleOutcome } from "@agari/db";
import type { Diagnosis } from "@agari/core/types";
import type { CommandJournal, CommandRow, CommandState, SeatIntent } from "@agari/markets/server";
import { createSeatLinkStore, SEAT_LINK_SCHEMA_SQL, type SeatLinkStore } from "./seat-link-store.server";

/**
 * The seat pool and the server command journal (plan §4, §8), in the app's Postgres through `@agari/db`'s `getDb()`.
 * The schema is this file's own, applied idempotently once per process under its own advisory lock (the `@agari/db`
 * `ensureSchema` pattern), so the projector lane's migrations never interleave with it.
 *
 * States: `free → leased → draining → free`. A lease is taken with `FOR UPDATE SKIP LOCKED`, so concurrent visitors
 * never wait on each other's row, and a partial unique index keeps one address on at most one leased seat. The idle
 * clock (15 min) counts only while the seat holds no open leg and no live quote (`busy_until_ms`); the hard cap
 * (~4 h) applies only after the last leg settles; a seat idle for a day whose next leg settles more than a day out
 * drains too (ops closes those legs out at cost). A drained seat is recycled only once the ledger shows it empty
 * (`recycle`, C9d: ops' seat drain every pass, the lease route as a fallback).
 */

export interface LeaseRules {
  idleTtlMs: number;
  hardCapMs: number;
  /** Devices silent this long, with every open leg settling later than this, drain the seat (plan §4). */
  longHoldMs: number;
  /** A waitlisted address that has not polled for this long loses its place. */
  waitlistStaleMs: number;
}

export const DEFAULT_RULES: LeaseRules = { idleTtlMs: 15 * 60_000, hardCapMs: 4 * 3_600_000, longHoldMs: 24 * 3_600_000, waitlistStaleMs: 60_000 };

export interface LeaseRow {
  leaseId: string;
  party: string;
  address: string;
  leasedAtMs: number;
  lastSeenMs: number;
  hardCapAtMs: number;
  busyUntilMs: number;
  nextSettleMs: number;
  openLegs: number;
  startOffset: number;
  fundedAtMs: number | null;
}

export type LeaseOutcome =
  | { kind: "leased"; lease: LeaseRow; fresh: boolean }
  | { kind: "pool-full"; total: number; inUse: number; nextFreeAtMs: number | null; position: number };

export interface SeatBusy {
  busyUntilMs: number;
  nextSettleMs: number;
  openLegs: number;
}

export interface SeatStore {
  ready(): Promise<void>;
  lease(address: string, nowMs: number, o: { startOffset: number; leaseId: string; rules?: LeaseRules }): Promise<LeaseOutcome>;
  byLease(leaseId: string): Promise<LeaseRow | null>;
  /** The live lease this key holds, or joined through a seat link (a joined key answers its seat's row). */
  byAddress(address: string): Promise<LeaseRow | null>;
  touch(leaseId: string, nowMs: number, busy?: SeatBusy): Promise<void>;
  /** The visitor let go: the seat drains (open legs settle or close out first). */
  release(leaseId: string, nowMs: number, reason: string): Promise<boolean>;
  /** Moves every lease the rules expire into `draining`; returns how many. */
  expire(nowMs: number, rules?: LeaseRules): Promise<number>;
  /** Draining seats, the one checked longest ago first, so a seat still holding a leg never blocks the others. */
  draining(limit: number): Promise<string[]>;
  markFree(party: string, nowMs: number): Promise<boolean>;
  /** Frees one draining seat if `work` finds it empty (see `@agari/db` `recycleDrainingSeat`). */
  recycle(party: string, nowMs: number, work: () => Promise<RecycleCheck>): Promise<RecycleOutcome>;
  markFunded(leaseId: string, nowMs: number): Promise<void>;
  stats(nowMs: number, rules?: LeaseRules): Promise<SeatPoolStats>;
  commands: CommandJournal;
  links: SeatLinkStore;
}

export interface SeatPoolStats {
  total: number;
  free: number;
  leased: number;
  draining: number;
  nextFreeAtMs: number | null;
  /** When the longest-draining seat started draining (null when none is). */
  oldestDrainingSinceMs: number | null;
  /** What the longest-draining seat was last found holding (null before its first check). */
  oldestDrainingNote: string | null;
  waitlist: number;
}

const SCHEMA_LOCK_KEY = 5_741_220_938_115_003n;
/** The two-key advisory lock namespace for per-address lease serialisation (`pg_advisory_xact_lock(int4, int4)`). */
const ADDRESS_LOCK_NS = 574_122;

class FreeRowsLocked extends Error {}

export const SEAT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS seat_pool (
  party text PRIMARY KEY,
  state text NOT NULL DEFAULT 'free' CHECK (state IN ('free', 'leased', 'draining', 'retired')),
  lease_id uuid,
  address text,
  leased_at_ms bigint,
  last_seen_ms bigint,
  hard_cap_at_ms bigint,
  busy_until_ms bigint NOT NULL DEFAULT 0,
  next_settle_ms bigint NOT NULL DEFAULT 0,
  open_legs integer NOT NULL DEFAULT 0,
  start_offset bigint NOT NULL DEFAULT 0,
  funded_at_ms bigint,
  freed_at_ms bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS seat_pool_leased_address ON seat_pool (address) WHERE state = 'leased';
CREATE UNIQUE INDEX IF NOT EXISTS seat_pool_lease_id ON seat_pool (lease_id) WHERE lease_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS seat_leases (
  lease_id uuid PRIMARY KEY,
  party text NOT NULL,
  address text NOT NULL,
  started_at_ms bigint NOT NULL,
  start_offset bigint NOT NULL,
  ended_at_ms bigint,
  end_reason text
);
CREATE INDEX IF NOT EXISTS seat_leases_address ON seat_leases (address, started_at_ms DESC);
CREATE TABLE IF NOT EXISTS seat_waitlist (
  address text PRIMARY KEY,
  enqueued_at_ms bigint NOT NULL,
  last_poll_ms bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS seat_commands (
  command_id text PRIMARY KEY,
  lease_id uuid NOT NULL,
  party text NOT NULL,
  kind text NOT NULL,
  begin_offset bigint NOT NULL,
  deadline_ms bigint NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'landed', 'failed', 'unknown')),
  update_id text,
  diagnosis jsonb,
  created_at_ms bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS seat_commands_lease ON seat_commands (lease_id, created_at_ms DESC);
${SEAT_RECYCLE_COLUMNS_SQL}
${SEAT_LINK_SCHEMA_SQL}`;

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const lease = (r: Row): LeaseRow => ({
  leaseId: String(r.lease_id),
  party: String(r.party),
  address: String(r.address),
  leasedAtMs: num(r.leased_at_ms),
  lastSeenMs: num(r.last_seen_ms),
  hardCapAtMs: num(r.hard_cap_at_ms),
  busyUntilMs: num(r.busy_until_ms),
  nextSettleMs: num(r.next_settle_ms),
  openLegs: num(r.open_legs),
  startOffset: num(r.start_offset),
  fundedAtMs: r.funded_at_ms === null || r.funded_at_ms === undefined ? null : num(r.funded_at_ms),
});
const command = (r: Row): CommandRow => ({
  commandId: String(r.command_id),
  leaseId: String(r.lease_id),
  party: String(r.party),
  kind: String(r.kind) as SeatIntent,
  beginOffset: num(r.begin_offset),
  deadlineMs: num(r.deadline_ms),
  state: String(r.state) as CommandState,
  updateId: r.update_id === null ? null : String(r.update_id),
  diagnosis: (r.diagnosis ?? null) as Diagnosis | null,
  createdAtMs: num(r.created_at_ms),
});

/** When a leased seat is next free under the rules: idle expiry, deferred while it is busy. */
export const freeAtMs = (r: Pick<LeaseRow, "lastSeenMs" | "busyUntilMs">, rules: LeaseRules): number => Math.max(r.lastSeenMs + rules.idleTtlMs, r.busyUntilMs);

export function createSeatStore(db: Db, pool: readonly string[]): SeatStore {
  let schema: Promise<void> | null = null;
  const ready = () =>
    (schema ??= db
      .begin(async (tx) => {
        await tx.unsafe(`SELECT pg_advisory_xact_lock(${SCHEMA_LOCK_KEY})`);
        await tx.unsafe(SEAT_SCHEMA_SQL);
        if (pool.length > 0) {
          await tx`INSERT INTO seat_pool (party) SELECT unnest(${pool as string[]}::text[]) ON CONFLICT (party) DO UPDATE SET state = CASE WHEN seat_pool.state = 'retired' THEN 'free' ELSE seat_pool.state END`;
          await tx`UPDATE seat_pool SET state = 'retired' WHERE state = 'free' AND NOT (party = ANY(${pool as string[]}::text[]))`;
        }
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        schema = null;
        throw error;
      }));

  const expireSql = (tx: Db, nowMs: number, rules: LeaseRules) => tx`
    WITH gone AS (
      UPDATE seat_pool SET state = 'draining', draining_since_ms = ${nowMs}
      WHERE state = 'leased' AND (
        (last_seen_ms + ${rules.idleTtlMs} < ${nowMs} AND busy_until_ms <= ${nowMs})
        OR (hard_cap_at_ms < ${nowMs} AND busy_until_ms <= ${nowMs})
        OR (last_seen_ms + ${rules.longHoldMs} < ${nowMs} AND open_legs > 0 AND next_settle_ms > ${nowMs + rules.longHoldMs})
      )
      RETURNING lease_id
    )
    UPDATE seat_leases SET ended_at_ms = ${nowMs}, end_reason = 'expired' WHERE lease_id IN (SELECT lease_id FROM gone) RETURNING lease_id`;

  const store: SeatStore = {
    ready,
    async lease(address, nowMs, o) {
      await ready();
      const rules = o.rules ?? DEFAULT_RULES;
      for (let attempt = 0; ; attempt++) {
        try {
          return await db.begin(async (tx) => {
            // One address at a time: two tabs of the same seat serialise here instead of racing to two seats.
            await tx`SELECT pg_advisory_xact_lock(${ADDRESS_LOCK_NS}, hashtext(${address}))`;
            const [mine] = await tx<Row[]>`SELECT * FROM seat_pool WHERE address = ${address} AND state = 'leased' FOR UPDATE`;
            if (mine) {
              const [renewed] = await tx<Row[]>`UPDATE seat_pool SET last_seen_ms = ${nowMs} WHERE party = ${String(mine.party)} RETURNING *`;
              return { kind: "leased" as const, lease: lease(renewed!), fresh: false };
            }
            await expireSql(tx as unknown as Db, nowMs, rules);
            await tx`DELETE FROM seat_waitlist WHERE last_poll_ms < ${nowMs - rules.waitlistStaleMs}`;
            const [ahead] = await tx<Row[]>`SELECT count(*)::int AS n FROM seat_waitlist WHERE address <> ${address} AND enqueued_at_ms < coalesce((SELECT enqueued_at_ms FROM seat_waitlist WHERE address = ${address}), ${nowMs + 1})`;
            const waiting = num(ahead?.n);
            const [free] = waiting > 0 ? [] : await tx<Row[]>`SELECT party FROM seat_pool WHERE state = 'free' ORDER BY freed_at_ms, party LIMIT 1 FOR UPDATE SKIP LOCKED`;
            if (!free && waiting === 0) {
              // Every free row is locked by a concurrent lease that may yet fail: that is "busy", not "full".
              const [left] = await tx<Row[]>`SELECT count(*)::int AS n FROM seat_pool WHERE state = 'free'`;
              if (num(left?.n) > 0) throw new FreeRowsLocked();
            }
            if (!free) {
              await tx`INSERT INTO seat_waitlist (address, enqueued_at_ms, last_poll_ms) VALUES (${address}, ${nowMs}, ${nowMs}) ON CONFLICT (address) DO UPDATE SET last_poll_ms = ${nowMs}`;
              const [s] = await tx<Row[]>`SELECT count(*) FILTER (WHERE state <> 'retired')::int AS total, count(*) FILTER (WHERE state IN ('leased', 'draining'))::int AS in_use, min(greatest(last_seen_ms + ${rules.idleTtlMs}, busy_until_ms)) FILTER (WHERE state = 'leased') AS next_free FROM seat_pool`;
              return { kind: "pool-full" as const, total: num(s?.total), inUse: num(s?.in_use), nextFreeAtMs: s?.next_free === null || s?.next_free === undefined ? null : num(s.next_free), position: waiting + 1 };
            }
            const party = String(free.party);
            const [taken] = await tx<Row[]>`
              UPDATE seat_pool SET state = 'leased', lease_id = ${o.leaseId}, address = ${address}, leased_at_ms = ${nowMs}, last_seen_ms = ${nowMs},
                hard_cap_at_ms = ${nowMs + rules.hardCapMs}, busy_until_ms = 0, next_settle_ms = 0, open_legs = 0, start_offset = ${o.startOffset}, funded_at_ms = NULL
              WHERE party = ${party} RETURNING *`;
            await tx`INSERT INTO seat_leases (lease_id, party, address, started_at_ms, start_offset) VALUES (${o.leaseId}, ${party}, ${address}, ${nowMs}, ${o.startOffset})`;
            await tx`DELETE FROM seat_waitlist WHERE address = ${address}`;
            return { kind: "leased" as const, lease: lease(taken!), fresh: true };
          });
        } catch (error) {
          // Two tabs of one address raced to a second seat: the unique index refused one; the retry finds the other's lease.
          if (attempt < 2 && (error as { code?: string }).code === "23505") continue;
          if (attempt < 8 && error instanceof FreeRowsLocked) {
            await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
    },
    async byLease(leaseId) {
      await ready();
      const [r] = await db<Row[]>`SELECT * FROM seat_pool WHERE lease_id = ${leaseId} AND state = 'leased'`;
      return r ? lease(r) : null;
    },
    async byAddress(address) {
      await ready();
      // C4c: the one address → party resolution ops shares (`@agari/db` `seatLeaseRowFor`): own lease or a joined key.
      const r = await seatLeaseRowFor(db, address);
      return r ? lease(r) : null;
    },
    async touch(leaseId, nowMs, busy) {
      await ready();
      if (busy) {
        await db`UPDATE seat_pool SET last_seen_ms = greatest(last_seen_ms, ${nowMs}), busy_until_ms = ${busy.busyUntilMs}, next_settle_ms = ${busy.nextSettleMs}, open_legs = ${busy.openLegs} WHERE lease_id = ${leaseId} AND state = 'leased'`;
      } else {
        await db`UPDATE seat_pool SET last_seen_ms = greatest(last_seen_ms, ${nowMs}) WHERE lease_id = ${leaseId} AND state = 'leased'`;
      }
    },
    async release(leaseId, nowMs, reason) {
      await ready();
      return db.begin(async (tx) => {
        const rows = await tx`UPDATE seat_pool SET state = 'draining', draining_since_ms = ${nowMs} WHERE lease_id = ${leaseId} AND state = 'leased' RETURNING party`;
        if (rows.length === 0) return false;
        await tx`UPDATE seat_leases SET ended_at_ms = ${nowMs}, end_reason = ${reason} WHERE lease_id = ${leaseId}`;
        return true;
      });
    },
    async expire(nowMs, rules = DEFAULT_RULES) {
      await ready();
      return db.begin(async (tx) => (await expireSql(tx as unknown as Db, nowMs, rules)).length);
    },
    async draining(limit) {
      await ready();
      return (await db<Row[]>`SELECT party FROM seat_pool WHERE state = 'draining' ORDER BY drain_checked_ms, party LIMIT ${limit}`).map((r) => String(r.party));
    },
    async markFree(party, nowMs) {
      await ready();
      const rows = await db`UPDATE seat_pool SET state = 'free', lease_id = NULL, address = NULL, freed_at_ms = ${nowMs}, open_legs = 0, busy_until_ms = 0, next_settle_ms = 0,
        draining_since_ms = NULL, drain_note = NULL WHERE party = ${party} AND state = 'draining' RETURNING party`;
      return rows.length > 0;
    },
    async recycle(party, nowMs, work) {
      await ready();
      return recycleDrainingSeat(db, party, nowMs, work);
    },
    async markFunded(leaseId, nowMs) {
      await ready();
      await db`UPDATE seat_pool SET funded_at_ms = ${nowMs} WHERE lease_id = ${leaseId}`;
    },
    async stats(nowMs, rules = DEFAULT_RULES) {
      await ready();
      const [s] = await db<Row[]>`SELECT count(*) FILTER (WHERE state <> 'retired')::int AS total, count(*) FILTER (WHERE state = 'free')::int AS free, count(*) FILTER (WHERE state = 'leased')::int AS leased, count(*) FILTER (WHERE state = 'draining')::int AS draining, min(greatest(last_seen_ms + ${rules.idleTtlMs}, busy_until_ms)) FILTER (WHERE state = 'leased') AS next_free,
        (SELECT count(*)::int FROM seat_waitlist WHERE last_poll_ms >= ${nowMs - rules.waitlistStaleMs}) AS waitlist FROM seat_pool`;
      const [oldest] = await db<Row[]>`SELECT coalesce(draining_since_ms, 0) AS since, drain_note FROM seat_pool WHERE state = 'draining' ORDER BY coalesce(draining_since_ms, 0), party LIMIT 1`;
      const next = s?.next_free;
      return {
        total: num(s?.total), free: num(s?.free), leased: num(s?.leased), draining: num(s?.draining),
        nextFreeAtMs: next === null || next === undefined ? null : Math.max(nowMs, num(next)),
        oldestDrainingSinceMs: oldest ? num(oldest.since) : null,
        oldestDrainingNote: oldest?.drain_note === null || oldest?.drain_note === undefined ? null : String(oldest.drain_note),
        waitlist: num(s?.waitlist),
      };
    },
    links: createSeatLinkStore(db, ready),
    commands: {
      async begin(row, nowMs) {
        await ready();
        await db`INSERT INTO seat_commands (command_id, lease_id, party, kind, begin_offset, deadline_ms, created_at_ms)
          VALUES (${row.commandId}, ${row.leaseId}, ${row.party}, ${row.kind}, ${row.beginOffset}, ${row.deadlineMs}, ${nowMs}) ON CONFLICT (command_id) DO NOTHING`;
        const [r] = await db<Row[]>`SELECT * FROM seat_commands WHERE command_id = ${row.commandId}`;
        return command(r!);
      },
      async finish(commandId, patch) {
        await ready();
        await db`UPDATE seat_commands SET state = ${patch.state}, update_id = coalesce(${patch.updateId ?? null}, update_id), diagnosis = ${patch.diagnosis ? db.json(patch.diagnosis as never) : null}
          WHERE command_id = ${commandId} AND state <> 'landed'`;
      },
      async get(commandId) {
        await ready();
        const [r] = await db<Row[]>`SELECT * FROM seat_commands WHERE command_id = ${commandId}`;
        return r ? command(r) : null;
      },
    },
  };
  return store;
}
