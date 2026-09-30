/**
 * C9d: the Room gate matches a guest seat's ADDRESS to the party it leased at the fill's time (skipped unless
 * SEAT_PG_URL is set; any scratch Postgres works, the test creates and drops its own tables).
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { socialGateReader } from "./social-gate";

const URL_ = process.env.SEAT_PG_URL;
const PARTY = "agari-user-seat-1::1220aa";
const ALICE = "AliceSeatAddress1111111111111111111111111111";
const BOB = "BobSeatAddress22222222222222222222222222222222";
/** Alice's phone, joined to her lease by a seat link (C4c). */
const ALICE_PHONE = "AlicePhoneKey33333333333333333333333333333333";
const ALICE_LEASE = "00000000-0000-4000-8000-00000000a11c";
const T = 1_790_000_000;

describe.skipIf(!URL_)("room gate over a recycled seat party (Postgres)", () => {
  const sql = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined });
  const gate = socialGateReader(sql);

  beforeAll(async () => {
    await sql.unsafe(`
      DROP TABLE IF EXISTS idx_fills, idx_markets, seat_leases, seat_linked_keys;
      CREATE TABLE idx_fills (update_id text, market text, owner_party text, owner_address text, ts_sec bigint);
      CREATE TABLE idx_markets (market text, symbol text, state text, expiry_sec bigint);
      CREATE TABLE seat_leases (lease_id uuid, party text, address text, started_at_ms bigint, start_offset bigint, ended_at_ms bigint, end_reason text);
      CREATE TABLE seat_linked_keys (address text PRIMARY KEY, lease_id uuid NOT NULL, linked_at_ms bigint NOT NULL);
    `);
    await sql`INSERT INTO idx_markets VALUES ('m1', 'BTC', 'open', ${T + 3600}), ('m2', 'BTC', 'open', ${T + 3600})`;
    // Alice leased the party first and bet on m1; Bob leased the same party after her and bet on m2.
    await sql`INSERT INTO seat_leases VALUES (${ALICE_LEASE}, ${PARTY}, ${ALICE}, ${T * 1000}, 1, ${(T + 600) * 1000}, 'released'),
                                             (gen_random_uuid(), ${PARTY}, ${BOB}, ${(T + 700) * 1000}, 2, NULL, NULL)`;
    await sql`INSERT INTO idx_fills VALUES ('u-alice', 'm1', ${PARTY}, NULL, ${T + 100}), ('u-bob', 'm2', ${PARTY}, NULL, ${T + 800})`;
    await sql`INSERT INTO seat_linked_keys VALUES (${ALICE_PHONE}, ${ALICE_LEASE}, ${(T + 50) * 1000})`;
  });
  afterAll(async () => {
    await sql.unsafe("DROP TABLE IF EXISTS idx_fills, idx_markets, seat_leases, seat_linked_keys");
    await sql.end();
  });

  it("admits the address that held the party when it bet", async () => {
    expect(await gate.fillBy("u-alice", "m1", ALICE)).toBe(true);
    expect(await gate.everBet("m1", ALICE)).toBe(true);
    expect(await gate.everBet("m2", BOB)).toBe(true);
    expect(await gate.everBetOnSymbol("BTC", BOB)).toBe(true);
  });

  it("never admits the party's earlier or later visitor on the other's bet", async () => {
    expect(await gate.everBet("m2", ALICE)).toBe(false);
    expect(await gate.everBet("m1", BOB)).toBe(false);
    expect(await gate.fillBy("u-alice", "m1", BOB)).toBe(false);
  });

  it("C4c: admits a key joined to the lease that bet, and only for that lease's bets", async () => {
    expect(await gate.everBet("m1", ALICE_PHONE)).toBe(true);
    expect(await gate.fillBy("u-alice", "m1", ALICE_PHONE)).toBe(true);
    expect(await gate.everBet("m2", ALICE_PHONE)).toBe(false);
    expect(await gate.fillBy("u-bob", "m2", ALICE_PHONE)).toBe(false);
  });

  it("still matches the party id itself", async () => {
    expect(await gate.everBet("m1", PARTY)).toBe(true);
  });
});
