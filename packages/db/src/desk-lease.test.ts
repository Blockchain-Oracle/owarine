/**
 * C4d H2 (K-210) against a real Postgres (`DATABASE_URL`, its own throwaway schema); skipped without one. The seat drain
 * closes the draining lease's desk rows: the holder's, a joined key's, and any row on the party's pre-C4d address,
 * each with a `state_set` event; the next lessee's rows and other parties' rows stay as they are.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sslFor } from "./client";
import { closeLeaseDesks } from "./desk-lease";
import { DESK_SCHEMA_SQL } from "./schema-desk";

const url = process.env.DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("closeLeaseDesks (real Postgres)", () => {
  const schema = `c4d_desk_lease_${Date.now().toString(36)}`;
  const db = postgres(url ?? "postgres://unused", { max: 1, ssl: url ? sslFor(url) : false, onnotice: () => undefined, connection: { search_path: schema } });
  const P = "seat-7::1220bb";
  const desk = async (owner: string, address: string | null, state = "active") =>
    (await db<{ id: string }[]>`INSERT INTO desks (address, owner, cluster, mode, state, created_at_sec, updated_at_sec) VALUES (${address}, ${owner}, 'devnet', 'on_its_own', ${state}, 1, 1) RETURNING id`)[0]!.id;
  const stateOf = async (id: string) => (await db<{ state: string; state_reason: string | null }[]>`SELECT state, state_reason FROM desks WHERE id = ${id}::uuid`)[0];

  beforeAll(async () => {
    await db.unsafe(`CREATE SCHEMA ${schema}`);
    await db.unsafe(DESK_SCHEMA_SQL);
    await db.unsafe(`CREATE TABLE seat_pool (party text PRIMARY KEY, state text NOT NULL, address text, lease_id text);
      CREATE TABLE seat_linked_keys (address text PRIMARY KEY, lease_id text NOT NULL);`);
  });
  afterAll(async () => {
    await db.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  });

  it("closes the draining lease's rows (holder, joined key, the party's old address) and nothing else", async () => {
    await db`INSERT INTO seat_pool (party, state, address, lease_id) VALUES (${P}, 'draining', 'holderA', 'lease-A'), ('seat-9::1220dd', 'leased', 'holderC', 'lease-C')`;
    await db`INSERT INTO seat_linked_keys (address, lease_id) VALUES ('phoneA', 'lease-A'), ('phoneC', 'lease-C')`;
    const holder = await desk("holderA", "addr-A");
    const joined = await desk("phoneA", "addr-A2");
    const oldRow = await desk("earlierVisitor", "legacy-P");
    const other = await desk("holderC", "addr-C");
    const otherJoined = await desk("phoneC", "addr-C2");
    const already = await desk("holderA-old", "legacy-P", "closed");

    const n = await closeLeaseDesks(db, { party: P, legacyAddress: "legacy-P", reason: "the seat was reset", nowSec: 1_800_000_000 });
    expect(n).toBe(3);
    for (const id of [holder, joined, oldRow]) expect(await stateOf(id)).toEqual({ state: "closed", state_reason: "the seat was reset" });
    for (const id of [other, otherJoined]) expect((await stateOf(id))?.state).toBe("active");
    expect((await stateOf(already))?.state_reason).toBeNull();
    const events = await db<{ desk_id: string }[]>`SELECT desk_id FROM desk_events WHERE kind = 'state_set'`;
    expect(events.map((e) => e.desk_id).sort()).toEqual([holder, joined, oldRow].sort());
    // Idempotent: a second pass finds nothing left open.
    expect(await closeLeaseDesks(db, { party: P, legacyAddress: "legacy-P", reason: "again", nowSec: 1_800_000_060 })).toBe(0);
  });
});
