import type { Db } from "@agari/db";

/**
 * The seat link's two tables (plan, iOS step 2b), created with the seat pool's schema (`SEAT_SCHEMA_SQL`):
 * `seat_link_codes`, one row per one-time code (60 s, used once, tied to the lease that showed it), and
 * `seat_linked_keys`, each joined key with the lease it joined. A lease id is never reused, so a joined key stops
 * resolving the moment its lease ends (release, expiry or recycle), with nothing to clean up.
 */
export const SEAT_LINK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS seat_link_codes (
  code text PRIMARY KEY,
  lease_id uuid NOT NULL,
  created_at_ms bigint NOT NULL,
  expires_at_ms bigint NOT NULL,
  used_at_ms bigint,
  used_by text
);
CREATE INDEX IF NOT EXISTS seat_link_codes_lease ON seat_link_codes (lease_id, created_at_ms DESC);
CREATE TABLE IF NOT EXISTS seat_linked_keys (
  address text PRIMARY KEY,
  lease_id uuid NOT NULL,
  linked_at_ms bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS seat_linked_keys_lease ON seat_linked_keys (lease_id);`;

export type RedeemOutcome =
  | { kind: "linked"; leaseId: string }
  /** Unknown, expired or already used: one answer, so a guess learns nothing. */
  | { kind: "invalid" }
  /** The joining key holds a seat of its own: it resets that seat first. */
  | { kind: "own-seat" };

export interface SeatLinkStore {
  /** Stores a fresh code for a leased seat; false when the code is taken (the caller draws another). */
  issue(leaseId: string, code: string, nowMs: number, ttlMs: number): Promise<boolean>;
  /** Codes this lease asked for since `sinceMs` (the route's rate limit). */
  issuedSince(leaseId: string, sinceMs: number): Promise<number>;
  /** Uses the code once and adds `address` to its lease, atomically. */
  redeem(code: string, address: string, nowMs: number): Promise<RedeemOutcome>;
  /** Where this lease's code stands: still showing, run out, or used by another device (the holder's screen polls it). */
  codeState(code: string, leaseId: string, nowMs: number): Promise<"showing" | "expired" | "linked" | null>;
  /** Whether `address` joined this lease (the cookie check for a joined browser). */
  isLinked(address: string, leaseId: string): Promise<boolean>;
  /** The joined key leaves its seat ("Reset seat" on the joined device); the seat itself stays leased. */
  unlink(address: string): Promise<boolean>;
}

type Row = Record<string, unknown>;

export function createSeatLinkStore(db: Db, ready: () => Promise<void>): SeatLinkStore {
  return {
    async issue(leaseId, code, nowMs, ttlMs) {
      await ready();
      const rows = await db`INSERT INTO seat_link_codes (code, lease_id, created_at_ms, expires_at_ms) VALUES (${code}, ${leaseId}, ${nowMs}, ${nowMs + ttlMs}) ON CONFLICT (code) DO NOTHING RETURNING code`;
      return rows.length > 0;
    },
    async issuedSince(leaseId, sinceMs) {
      await ready();
      const [r] = await db<Row[]>`SELECT count(*)::int AS n FROM seat_link_codes WHERE lease_id = ${leaseId} AND created_at_ms >= ${sinceMs}`;
      return Number(r?.n ?? 0);
    },
    async redeem(code, address, nowMs) {
      await ready();
      return db.begin(async (tx) => {
        const [used] = await tx<Row[]>`
          UPDATE seat_link_codes SET used_at_ms = ${nowMs}, used_by = ${address}
          WHERE code = ${code} AND used_at_ms IS NULL AND expires_at_ms > ${nowMs}
            AND lease_id IN (SELECT lease_id FROM seat_pool WHERE state = 'leased' AND lease_id IS NOT NULL)
          RETURNING lease_id`;
        if (!used) return { kind: "invalid" as const };
        const leaseId = String(used.lease_id);
        const [own] = await tx<Row[]>`SELECT lease_id FROM seat_pool WHERE address = ${address} AND state = 'leased'`;
        // The seat's own key scanning its own code is already that seat: nothing to add.
        if (own) return String(own.lease_id) === leaseId ? { kind: "linked" as const, leaseId } : { kind: "own-seat" as const };
        await tx`INSERT INTO seat_linked_keys (address, lease_id, linked_at_ms) VALUES (${address}, ${leaseId}, ${nowMs})
          ON CONFLICT (address) DO UPDATE SET lease_id = EXCLUDED.lease_id, linked_at_ms = EXCLUDED.linked_at_ms`;
        return { kind: "linked" as const, leaseId };
      });
    },
    async codeState(code, leaseId, nowMs) {
      await ready();
      const [r] = await db<Row[]>`SELECT used_at_ms, expires_at_ms FROM seat_link_codes WHERE code = ${code} AND lease_id = ${leaseId}`;
      if (!r) return null;
      if (r.used_at_ms !== null && r.used_at_ms !== undefined) return "linked";
      return Number(r.expires_at_ms) > nowMs ? "showing" : "expired";
    },
    async isLinked(address, leaseId) {
      await ready();
      const [r] = await db<Row[]>`SELECT 1 AS one FROM seat_linked_keys WHERE address = ${address} AND lease_id = ${leaseId}`;
      return Boolean(r);
    },
    async unlink(address) {
      await ready();
      return (await db`DELETE FROM seat_linked_keys WHERE address = ${address} RETURNING address`).length > 0;
    },
  };
}
