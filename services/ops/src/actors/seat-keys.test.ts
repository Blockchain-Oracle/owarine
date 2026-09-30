/**
 * C4c: every ops path that turns a seat key into a party goes through `@agari/db`'s one resolution, and it knows keys
 * joined by a seat link for the CURRENT lease only (skipped unless SEAT_PG_URL is set; the test works in its own
 * schema, so it never touches the web's seat tables):
 *
 *   SEAT_PG_URL=postgres://… pnpm exec vitest run services/ops/src/actors/seat-keys.test.ts
 *
 * The three paths: the agents session (a grant's owner label), the duel's seat directory (the open and the season
 * payout), and desk discovery (a party back to its seat address).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, seatPartyFor } from "@agari/db";
import { ownerPartyOf } from "./agents/session";
import { createSeatDirectory } from "./arena-desk/seats";
import { seatAddressOf } from "./desk-runner/discover";

const URL_ = process.env.SEAT_PG_URL;
const SCHEMA = "c4c_seat_keys";
const A = "agari-user-seat-1::1220aaaa0001";
const B = "agari-user-seat-2::1220bbbb0002";

describe.skipIf(!URL_)("seat keys: one resolution for ops (Postgres)", () => {
  // Its own schema: an unknown URL parameter is a connection parameter to postgres.js, so every pooled connection has it.
  if (URL_) process.env.DATABASE_URL = `${URL_}${URL_.includes("?") ? "&" : "?"}search_path=${SCHEMA}`;
  const db = getDb()!;

  // The web's lifecycle, as SQL: take a lease, join a key to it, let it go, free it.
  const lease = async (party: string, address: string) => {
    const leaseId = randomUUID();
    await db`UPDATE seat_pool SET state = 'leased', lease_id = ${leaseId}, address = ${address} WHERE party = ${party}`;
    return leaseId;
  };
  const join = (address: string, leaseId: string) =>
    db`INSERT INTO seat_linked_keys (address, lease_id, linked_at_ms) VALUES (${address}, ${leaseId}, 1)
       ON CONFLICT (address) DO UPDATE SET lease_id = EXCLUDED.lease_id`;
  const release = (party: string) => db`UPDATE seat_pool SET state = 'draining' WHERE party = ${party}`;
  const free = (party: string) => db`UPDATE seat_pool SET state = 'free', lease_id = NULL, address = NULL WHERE party = ${party}`;

  beforeAll(async () => {
    await db.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  });
  beforeEach(async () => {
    await db.unsafe(`
      DROP TABLE IF EXISTS seat_pool, seat_linked_keys;
      CREATE TABLE seat_pool (party text PRIMARY KEY, state text NOT NULL DEFAULT 'free', lease_id uuid, address text);
      CREATE TABLE seat_linked_keys (address text PRIMARY KEY, lease_id uuid NOT NULL, linked_at_ms bigint NOT NULL);
    `);
    await db`INSERT INTO seat_pool (party) VALUES (${A}), (${B})`;
  });
  afterAll(async () => {
    await db.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await db.end();
  });

  it("a joined key can grant, duel and desk: each path answers its seat's party", async () => {
    const leaseA = await lease(A, "web-a");
    await lease(B, "web-b");
    await join("phone-a", leaseA);

    // grant: the agents session's owner label
    expect(await ownerPartyOf("phone-a", db)).toBe(A);
    expect(await ownerPartyOf("web-a", db)).toBe(A);
    expect(await ownerPartyOf(A, db)).toBe(A);
    // duel: the seat directory the open and the payout act on; the proved pairing is what the room shows
    const seats = createSeatDirectory(db, () => {});
    expect(await seats.partyOf("phone-a")).toBe(A);
    expect(seats.addressOf(A)).toBe("phone-a");
    expect(await seats.partyOf("web-b")).toBe(B);
    // desk: discovery names the party by the key that took its lease
    expect(await seatAddressOf(A, db)).toBe("web-a");
    expect(await seatAddressOf(B, db)).toBe("web-b");
  });

  it("an old key maps nothing after the reset, and a recycled seat never maps its old devices", async () => {
    const seats = createSeatDirectory(db, () => {});
    const leaseA = await lease(A, "web-a");
    await join("phone-a", leaseA);
    expect(await seats.partyOf("phone-a")).toBe(A);

    await release(A);
    expect(await seatPartyFor(db, "phone-a")).toBeNull();
    expect(await seatPartyFor(db, "web-a")).toBeNull();
    // What this process remembers never stands in for the lease: the pairing it saw is gone with it.
    expect(await seats.partyOf("phone-a")).toBeNull();
    expect(await ownerPartyOf("phone-a", db)).toBeNull();
    expect(await seatAddressOf(A, db)).toBeNull();

    await free(A);
    await lease(A, "web-c");
    expect(await seatPartyFor(db, "web-c")).toBe(A);
    for (const old of ["phone-a", "web-a"]) {
      expect(await seatPartyFor(db, old)).toBeNull();
      expect(await seats.partyOf(old)).toBeNull();
      expect(await ownerPartyOf(old, db)).toBeNull();
    }
    expect(await seatAddressOf(A, db)).toBe("web-c");
  });

  it("a key joined to seat A never maps to seat B", async () => {
    const leaseA = await lease(A, "web-a");
    await lease(B, "web-b");
    await join("phone-a", leaseA);
    expect(await seatPartyFor(db, "phone-a")).toBe(A);
    // Seat A ends while B is live: the key does not fall through to the other seat.
    await release(A);
    expect(await seatPartyFor(db, "phone-a")).toBeNull();
    expect(await createSeatDirectory(db, () => {}).partyOf("phone-a")).toBeNull();
    // Seat A is freed and its party leased again as a new lease: the old link names the old lease id, so nothing.
    await free(A);
    await lease(A, "web-d");
    expect(await seatPartyFor(db, "phone-a")).toBeNull();
    expect(await seatPartyFor(db, "web-b")).toBe(B);
  });

  it("a pool without the seat link table still resolves lease holders", async () => {
    await db.unsafe("DROP TABLE seat_linked_keys");
    await lease(A, "web-a");
    expect(await seatPartyFor(db, "web-a")).toBe(A);
    expect(await seatPartyFor(db, "phone-a")).toBeNull();
  });
});
