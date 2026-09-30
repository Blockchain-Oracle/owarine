/**
 * The pre-open resting call in the projection (abu-pm-main 0.5.1, K-235): one row per call under its stable reference,
 * kept when the call ends so the portfolio can say how each ended, served only to the owner's seat under its lease, and a
 * fill that came from a resting call reads as "your resting call filled" in the seat's own inbox.
 *
 * Runs against a real Postgres in its own namespace (skipped unless SEAT_PG_URL names a scratch database):
 *
 *   SEAT_PG_URL=postgres://localhost/pm_c7c pnpm vitest run packages/db/src/idx/resting.test.ts
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "../schema";
import { indexReader, type IdxSeatLease } from "./read";
import { seatActivityReader } from "./seat-activity";
import { indexWriter } from "./write";
import type { IdxFact, IdxUpdate } from "./types";

const URL_ = process.env.SEAT_PG_URL;
const NS = "c7c_resting_test";
const VENUE = "agari-venue::1220bb";
const ALICE = "agari-user-seat-1::1220aa";
const BOB = "agari-user-seat-2::1220cc";
const STREAM = "venue";
const T = 1_790_000_000;
const LEASE: IdxSeatLease = { party: ALICE, fromOffset: 1 };
const BOB_LEASE: IdxSeatLease = { party: BOB, fromOffset: 1 };

let offset = 0;
const update = (facts: IdxFact[], atSec = T): IdxUpdate => ({
  updateId: `u${++offset}`, offset, recordTimeMs: null, effectiveAtMs: atSec * 1000, commandId: null, workflowId: null, events: [], facts,
});

const windowOpened = (): IdxFact => ({
  kind: "window-opened", termsCid: "terms-1", marketKey: "TSLA-5m:7", seriesKey: "TSLA-5m", index: 7, symbol: "TSLA", cashUnit: "1000", tradingStartSec: T + 300, lockAtSec: T + 540,
  expirySec: T + 600, openDeadlineSec: T + 420, closeDeadlineSec: T + 720, refundAfterSec: T + 1_300, policyVersion: 1, printSource: "attested", minDelaySec: 5, barLenSec: 60, tieUp: true,
  quorum: 1, oracles: [], maxDeviationBps: 50, resolver: "resolver::1",
});
const placed = (callRef: string, cid: string, user = ALICE, o: Partial<Extract<IdxFact, { kind: "rest-call" }>> = {}): IdxFact => ({
  kind: "rest-call", contractId: cid, callRef, user, termsCid: "terms-1", marketKey: "TSLA-5m:7", side: 0, priceTicks: 550, lotsPlaced: "10", lots: "10", cashUnit: "1000", escrow: "5500000",
  tradingStartSec: T + 300, expiresAtSec: T + 390, placed: true, ...o,
});

describe.skipIf(!URL_)("resting calls in the projection (Postgres)", () => {
  const admin = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined });
  const sql = postgres(URL_ ?? "postgres://invalid", { max: 1, onnotice: () => undefined, connection: { search_path: NS } });
  const writer = indexWriter(sql);
  const reader = indexReader(sql);
  const inbox = seatActivityReader(sql);
  const apply = (facts: IdxFact[], atSec?: number) => writer.applyUpdate(STREAM, VENUE, update(facts, atSec));

  beforeAll(async () => {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${NS} CASCADE; CREATE SCHEMA ${NS}`);
    await sql.unsafe(SCHEMA_SQL);
    await apply([windowOpened()]);
  }, 60_000);
  afterAll(async () => {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${NS} CASCADE`);
    await sql.end();
    await admin.end();
  }, 60_000);

  const rows = (lease = LEASE, owner = lease.party) => reader.restingCalls({ owner, lease });
  const byRef = async (ref: string, lease = LEASE) => (await rows(lease)).find((r) => r.call_ref === ref);

  it("a placed call is one open row: an UP call is a BUY_YES at its own price, a DOWN call a BUY_NO at the complement", async () => {
    await apply([placed("rc-up", "cid-up"), placed("rc-down", "cid-down", ALICE, { side: 1, priceTicks: 450, escrow: "4500000" })]);
    expect(await byRef("rc-up")).toMatchObject({ kind: 0, limit_price: 550, lots: "10", filled_lots: "0", remaining_lots: "10", status: "open", expire_ts_sec: String(T + 390), call_ref: "rc-up" });
    expect(await byRef("rc-down")).toMatchObject({ kind: 2, limit_price: 550, side_ticks: 450, status: "open" });
  });

  it("a replayed placement changes nothing", async () => {
    const before = await sql`SELECT count(*)::int AS n FROM idx_resting`;
    await apply([placed("rc-up", "cid-up")]);
    expect((await sql`SELECT count(*)::int AS n FROM idx_resting`)[0]!.n).toBe(before[0]!.n);
  });

  it("a partial fill moves the row to the remainder's contract, under the same reference; the fill is a resting-marked trade", async () => {
    await apply([
      { kind: "leg", nodeId: 0, contractId: "leg-a1", owner: ALICE, venue: VENUE, termsCid: "terms-1", marketKey: "TSLA-5m:7", pairId: "rc-up#0", outcome: 0, lots: "4", cashUnit: "1000", backingShare: "2200000", feePaid: "0", refundAfterSec: T + 1_300, origin: "accept", acceptNodeId: 0, quoteCid: "cid-up", resting: true },
      placed("rc-up", "cid-up-2", ALICE, { lots: "6", escrow: "3300000", placed: false }),
    ], T + 310);
    expect(await byRef("rc-up")).toMatchObject({ call_cid: "cid-up-2", lots: "10", filled_lots: "4", remaining_lots: "6", status: "open" });
    const [fill] = await sql`SELECT resting, quote_cid, lots::text AS lots, side_ticks FROM idx_fills WHERE owner_party = ${ALICE}`;
    expect(fill).toMatchObject({ resting: true, quote_cid: "cid-up", lots: "4", side_ticks: 550 });
    // the position the fill makes is an ordinary one
    const [pos] = await sql`SELECT yes_lots::text AS yes, open_legs FROM idx_positions WHERE owner_party = ${ALICE}`;
    expect(pos).toMatchObject({ yes: "4", open_legs: 1 });
  });

  it("the seat's own inbox reads that fill as its resting call, not as a taker's", async () => {
    const [f] = await inbox.fills(ALICE, LEASE);
    expect(f).toMatchObject({ seat: "maker", lots: "4", market: expect.any(String) });
  });

  it("swept unfilled is `expired` with what came back; the remainder's lots are the ones refunded", async () => {
    await apply([{ kind: "rest-closed", contractId: "cid-up-2", how: "expired", refundedBase: "3300000" }], T + 392);
    expect(await byRef("rc-up")).toMatchObject({ status: "expired", filled_lots: "4", remaining_lots: "0", refunded_base: "3300000", closed_ts_sec: String(T + 392) });
  });

  it("cancelled before the bell is `cancelled` with the whole stake back", async () => {
    await apply([{ kind: "rest-closed", contractId: "cid-down", how: "cancelled", refundedBase: "4500000" }], T + 100);
    expect(await byRef("rc-down")).toMatchObject({ status: "cancelled", filled_lots: "0", remaining_lots: "0", refunded_base: "4500000" });
  });

  it("a call filled completely is `filled` with nothing left", async () => {
    await apply([placed("rc-full", "cid-full", ALICE, { lots: "2", lotsPlaced: "2", escrow: "1100000" })]);
    await apply([{ kind: "rest-closed", contractId: "cid-full", how: "filled", refundedBase: "0" }], T + 305);
    expect(await byRef("rc-full")).toMatchObject({ status: "filled", filled_lots: "2", remaining_lots: "0", refunded_base: "0" });
  });

  it("`open` keeps only what still rests", async () => {
    await apply([placed("rc-live", "cid-live")]);
    expect((await reader.restingCalls({ owner: ALICE, lease: LEASE, openOnly: true })).map((r) => r.call_ref)).toEqual(["rc-live"]);
  });

  it("another seat reads none of them, and a seat with no lease reads nothing", async () => {
    await apply([placed("rc-bob", "cid-bob", BOB)]);
    expect((await rows(BOB_LEASE)).map((r) => r.call_ref)).toEqual(["rc-bob"]);
    expect((await rows(LEASE)).map((r) => r.call_ref)).not.toContain("rc-bob");
    expect(await reader.restingCalls({ owner: "SomeoneElseAddress1111111111111111111111111" })).toEqual([]);
  });
});
