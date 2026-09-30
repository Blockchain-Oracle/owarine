import type { Db } from "@agari/db";
import { SEAT_LINK_CONFIRM_MS } from "@agari/markets";

/**
 * The seat link's two tables (plan, iOS step 2b), created with the seat pool's schema (`SEAT_SCHEMA_SQL`):
 * `seat_link_codes`, one row per one-time code (60 s, used once, tied to the lease that showed it), and
 * `seat_linked_keys`, each joined key with the lease it joined. A lease id is never reused, so a joined key stops
 * resolving the moment its lease ends (release, expiry or recycle), with nothing to clean up.
 *
 * C4c (security review L1): using a code only CLAIMS it for the joining key; the key joins the lease when the holder's
 * device allows it (`decide`), within `SEAT_LINK_CONFIRM_MS` of the claim. Every failed redeem counts against every code
 * live at that moment (`failures`), and a code that has seen `LINK_CODE_MAX_FAILURES` wrong guesses is dead, however
 * many addresses the guesses came from.
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
ALTER TABLE seat_link_codes ADD COLUMN IF NOT EXISTS failures integer NOT NULL DEFAULT 0;
ALTER TABLE seat_link_codes ADD COLUMN IF NOT EXISTS confirmed_at_ms bigint;
ALTER TABLE seat_link_codes ADD COLUMN IF NOT EXISTS declined_at_ms bigint;
CREATE INDEX IF NOT EXISTS seat_link_codes_lease ON seat_link_codes (lease_id, created_at_ms DESC);
CREATE TABLE IF NOT EXISTS seat_linked_keys (
  address text PRIMARY KEY,
  lease_id uuid NOT NULL,
  linked_at_ms bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS seat_linked_keys_lease ON seat_linked_keys (lease_id);`;

/** Wrong guesses, from anywhere, that end every code live while they arrive (review L1). */
export const LINK_CODE_MAX_FAILURES = 25;

export type RedeemOutcome =
  /** The code is claimed for this key; the holder's device allows or refuses it (`decide`). */
  | { kind: "pending"; leaseId: string }
  /** The seat's own key used its own code: it is already that seat. */
  | { kind: "linked"; leaseId: string }
  /** Unknown, expired, used or locked: one answer, so a guess learns nothing. */
  | { kind: "invalid" }
  /** The joining key holds a seat of its own: it resets that seat first. */
  | { kind: "own-seat" };

export type CodeState = "showing" | "expired" | "pending" | "linked" | "declined";
export type ClaimState = "pending" | "linked" | "declined" | "expired";

export interface SeatLinkStore {
  /** Stores a fresh code for a leased seat; false when the code is taken (the caller draws another). */
  issue(leaseId: string, code: string, nowMs: number, ttlMs: number): Promise<boolean>;
  /** Codes this lease asked for since `sinceMs` (the route's rate limit). */
  issuedSince(leaseId: string, sinceMs: number): Promise<number>;
  /** Uses the code once and claims it for `address`; a miss counts against every live code. */
  redeem(code: string, address: string, nowMs: number): Promise<RedeemOutcome>;
  /** Where this lease's code stands (the holder's screen polls it); `device` is the key waiting on it, when one is. */
  codeState(code: string, leaseId: string, nowMs: number): Promise<{ state: CodeState; device: string | null } | null>;
  /** The holder's answer to the key waiting on its code: allowed, it joins the lease; refused or late, it never does. */
  decide(code: string, leaseId: string, allow: boolean, nowMs: number): Promise<"linked" | "declined" | "gone">;
  /** What the joining key's claim came to (the join route waits on it). */
  claimState(code: string, address: string, nowMs: number): Promise<ClaimState>;
  /** Whether `address` joined this lease (the cookie check for a joined browser). */
  isLinked(address: string, leaseId: string): Promise<boolean>;
  /** The joined key leaves its seat ("Reset seat" on the joined device); the seat itself stays leased. */
  unlink(address: string): Promise<boolean>;
}

type Row = Record<string, unknown>;
const set = (v: unknown) => v !== null && v !== undefined;

export function createSeatLinkStore(db: Db, ready: () => Promise<void>, confirmMs = SEAT_LINK_CONFIRM_MS): SeatLinkStore {
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
          WHERE code = ${code} AND used_at_ms IS NULL AND expires_at_ms > ${nowMs} AND failures < ${LINK_CODE_MAX_FAILURES}
            AND lease_id IN (SELECT lease_id FROM seat_pool WHERE state = 'leased' AND lease_id IS NOT NULL)
          RETURNING lease_id`;
        if (!used) {
          // A miss is a guess until shown otherwise: every code live right now carries it.
          await tx`UPDATE seat_link_codes SET failures = failures + 1 WHERE used_at_ms IS NULL AND expires_at_ms > ${nowMs}`;
          return { kind: "invalid" as const };
        }
        const leaseId = String(used.lease_id);
        const [own] = await tx<Row[]>`SELECT lease_id FROM seat_pool WHERE address = ${address} AND state = 'leased'`;
        // The seat's own key scanning its own code is already that seat: nothing to add.
        if (own) return String(own.lease_id) === leaseId ? { kind: "linked" as const, leaseId } : { kind: "own-seat" as const };
        return { kind: "pending" as const, leaseId };
      });
    },
    async codeState(code, leaseId, nowMs) {
      await ready();
      const [r] = await db<Row[]>`SELECT used_at_ms, used_by, expires_at_ms, failures, confirmed_at_ms, declined_at_ms FROM seat_link_codes WHERE code = ${code} AND lease_id = ${leaseId}`;
      if (!r) return null;
      const device = set(r.used_by) ? String(r.used_by) : null;
      if (set(r.confirmed_at_ms)) return { state: "linked", device };
      if (set(r.declined_at_ms)) return { state: "declined", device };
      if (set(r.used_at_ms)) return Number(r.used_at_ms) + confirmMs > nowMs ? { state: "pending", device } : { state: "expired", device: null };
      if (Number(r.failures) >= LINK_CODE_MAX_FAILURES) return { state: "expired", device: null };
      return { state: Number(r.expires_at_ms) > nowMs ? "showing" : "expired", device: null };
    },
    async decide(code, leaseId, allow, nowMs) {
      await ready();
      return db.begin(async (tx) => {
        const [claim] = await tx<Row[]>`
          SELECT used_by FROM seat_link_codes
          WHERE code = ${code} AND lease_id = ${leaseId} AND used_by IS NOT NULL AND used_at_ms > ${nowMs - confirmMs}
            AND confirmed_at_ms IS NULL AND declined_at_ms IS NULL
            AND lease_id IN (SELECT lease_id FROM seat_pool WHERE state = 'leased' AND lease_id IS NOT NULL)
          FOR UPDATE`;
        if (!claim) return "gone" as const;
        if (!allow) {
          await tx`UPDATE seat_link_codes SET declined_at_ms = ${nowMs} WHERE code = ${code}`;
          return "declined" as const;
        }
        const address = String(claim.used_by);
        await tx`UPDATE seat_link_codes SET confirmed_at_ms = ${nowMs} WHERE code = ${code}`;
        await tx`INSERT INTO seat_linked_keys (address, lease_id, linked_at_ms) VALUES (${address}, ${leaseId}, ${nowMs})
          ON CONFLICT (address) DO UPDATE SET lease_id = EXCLUDED.lease_id, linked_at_ms = EXCLUDED.linked_at_ms`;
        return "linked" as const;
      });
    },
    async claimState(code, address, nowMs) {
      await ready();
      const [r] = await db<Row[]>`SELECT used_at_ms, confirmed_at_ms, declined_at_ms FROM seat_link_codes WHERE code = ${code} AND used_by = ${address}`;
      if (!r) return "expired";
      if (set(r.confirmed_at_ms)) return "linked";
      if (set(r.declined_at_ms)) return "declined";
      return Number(r.used_at_ms) + confirmMs > nowMs ? "pending" : "expired";
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
