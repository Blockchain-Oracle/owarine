/**
 * The lease SQL against a real Postgres (skipped unless SEAT_PG_URL is set):
 *
 *   docker run -d --name pm-c4a-pg -e POSTGRES_PASSWORD=pm -p 5434:5432 postgres:16
 *   SEAT_PG_URL=postgres://postgres:pm@localhost:5434/pm_c4a pnpm --filter web exec vitest run src/lib/seat-store.server.test.ts
 */
import { getDb } from "@agari/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createSeatStore, DEFAULT_RULES, type LeaseRules } from "./seat-store.server";

const URL_ = process.env.SEAT_PG_URL;
const PARTIES = ["seat-1::1220aa", "seat-2::1220bb", "seat-3::1220cc"];
const RULES: LeaseRules = { ...DEFAULT_RULES, idleTtlMs: 900_000, hardCapMs: 4 * 3_600_000 };
const T0 = 1_790_000_000_000;

describe.skipIf(!URL_)("seat store (Postgres)", () => {
  // `@agari/db`'s own client, pointed at the test database (the store uses exactly this in the app).
  if (URL_) process.env.DATABASE_URL = URL_;
  const db = getDb()!;
  const lease = (store: ReturnType<typeof createSeatStore>, address: string, now = T0) =>
    store.lease(address, now, { startOffset: 7, leaseId: randomUUID(), rules: RULES });
  let store: ReturnType<typeof createSeatStore>;

  beforeEach(async () => {
    await db.unsafe("DROP TABLE IF EXISTS seat_pool, seat_leases, seat_waitlist, seat_commands");
    store = createSeatStore(db, PARTIES);
    await store.ready();
  });
  afterAll(() => db.end());

  it("leases a free seat, renews it for the same address, and gives another address another seat", async () => {
    const a = await lease(store, "addrA");
    expect(a.kind).toBe("leased");
    if (a.kind !== "leased") return;
    expect(a.fresh).toBe(true);
    expect(PARTIES).toContain(a.lease.party);
    expect(a.lease.startOffset).toBe(7);
    const again = await lease(store, "addrA", T0 + 5_000);
    expect(again).toMatchObject({ kind: "leased", fresh: false, lease: { party: a.lease.party, leaseId: a.lease.leaseId, lastSeenMs: T0 + 5_000 } });
    const b = await lease(store, "addrB");
    expect(b.kind === "leased" && b.lease.party).not.toBe(a.lease.party);
    expect(await store.byLease(a.lease.leaseId)).toMatchObject({ address: "addrA" });
    expect(await store.byAddress("addrB")).toMatchObject({ party: b.kind === "leased" ? b.lease.party : "" });
  });

  it("answers pool-full with a next-free estimate and a FIFO position, and serves the waitlist in order", async () => {
    for (const a of ["a1", "a2", "a3"]) expect((await lease(store, a)).kind).toBe("leased");
    const w1 = await lease(store, "w1", T0 + 1_000);
    const w2 = await lease(store, "w2", T0 + 2_000);
    expect(w1).toEqual({ kind: "pool-full", total: 3, inUse: 3, nextFreeAtMs: T0 + RULES.idleTtlMs, position: 1 });
    expect(w2).toMatchObject({ kind: "pool-full", position: 2 });
    // a1 lets go; the seat drains, is found empty and freed. w2 asks first but w1 is ahead of it.
    const a1 = await store.byAddress("a1");
    await store.release(a1!.leaseId, T0 + 3_000, "released");
    expect(await store.draining(5)).toEqual([a1!.party]);
    expect(await store.markFree(a1!.party, T0 + 3_000)).toBe(true);
    expect(await lease(store, "w2", T0 + 4_000)).toMatchObject({ kind: "pool-full", position: 2 });
    expect(await lease(store, "w1", T0 + 5_000)).toMatchObject({ kind: "leased", lease: { party: a1!.party } });
  });

  it("drains an idle seat, but never one whose open leg or live quote keeps it busy", async () => {
    const idle = await lease(store, "idle");
    const busy = await lease(store, "busy");
    if (idle.kind !== "leased" || busy.kind !== "leased") throw new Error("lease failed");
    await store.touch(busy.lease.leaseId, T0, { busyUntilMs: T0 + 5 * 3_600_000, nextSettleMs: T0 + 4 * 3_600_000, openLegs: 1 });
    const later = T0 + RULES.idleTtlMs + 1;
    expect(await store.expire(later, RULES)).toBe(1);
    expect(await store.byLease(idle.lease.leaseId)).toBeNull();
    expect(await store.byLease(busy.lease.leaseId)).not.toBeNull();
    // Past the hard cap, still busy: kept. Once its legs are done (busy clock passed), the cap and the idle clock apply.
    expect(await store.expire(T0 + RULES.hardCapMs + 1, RULES)).toBe(0);
    expect(await store.expire(T0 + 5 * 3_600_000 + 1, RULES)).toBe(1);
    expect(await store.draining(5)).toHaveLength(2);
  });

  it("drains a seat silent for a day whose every open leg settles more than a day out", async () => {
    const far = await lease(store, "far");
    const near = await lease(store, "near");
    if (far.kind !== "leased" || near.kind !== "leased") throw new Error("lease failed");
    const day = RULES.longHoldMs;
    await store.touch(far.lease.leaseId, T0, { busyUntilMs: T0 + 5 * day, nextSettleMs: T0 + 3 * day, openLegs: 2 });
    await store.touch(near.lease.leaseId, T0, { busyUntilMs: T0 + 5 * day, nextSettleMs: T0 + day + 3_600_000, openLegs: 2 });
    expect(await store.expire(T0 + day + 1, RULES)).toBe(1);
    expect(await store.byLease(far.lease.leaseId)).toBeNull();
    expect(await store.byLease(near.lease.leaseId)).not.toBeNull();
  });

  it("under concurrent requests, hands out each seat once and one address never holds two", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => lease(store, `c${i}`)));
    const leased = results.filter((r) => r.kind === "leased");
    expect(leased).toHaveLength(3);
    expect(new Set(leased.map((r) => (r.kind === "leased" ? r.lease.party : "")))).toEqual(new Set(PARTIES));
    await db.unsafe("DROP TABLE IF EXISTS seat_pool, seat_leases, seat_waitlist, seat_commands");
    store = createSeatStore(db, PARTIES);
    const same = await Promise.all(Array.from({ length: 6 }, () => lease(store, "one")));
    const parties = new Set(same.map((r) => (r.kind === "leased" ? r.lease.party : r.kind)));
    expect(parties.size, JSON.stringify(same)).toBe(1);
    expect((await db`SELECT count(*)::int AS n FROM seat_pool WHERE state = 'leased'`)[0]!.n).toBe(1);
  });

  it("recycles a freed seat with a new lease id and empty busy clock", async () => {
    const first = await lease(store, "first");
    if (first.kind !== "leased") throw new Error("lease failed");
    await store.touch(first.lease.leaseId, T0, { busyUntilMs: T0 + 1, nextSettleMs: T0 + 1, openLegs: 1 });
    await store.markFunded(first.lease.leaseId, T0);
    await store.release(first.lease.leaseId, T0 + 10, "released");
    await store.markFree(first.lease.party, T0 + 10);
    for (const a of ["x", "y"]) await lease(store, a, T0 + 20);
    const next = await lease(store, "second", T0 + 30);
    expect(next).toMatchObject({ kind: "leased", fresh: true, lease: { party: first.lease.party, openLegs: 0, busyUntilMs: 0, fundedAtMs: null } });
    expect(next.kind === "leased" && next.lease.leaseId).not.toBe(first.lease.leaseId);
    const log = await db`SELECT end_reason FROM seat_leases WHERE lease_id = ${first.lease.leaseId}`;
    expect(log[0]!.end_reason).toBe("released");
  });

  it("keeps a command journal row per command id, owned by its lease", async () => {
    const row = { commandId: "accept:0b6f3a7e-58a1-4d4e-9b1a-2f1f6c1f0a11", leaseId: randomUUID(), party: PARTIES[0]!, kind: "accept" as const, beginOffset: 42, deadlineMs: T0 + 20_000 };
    const a = await store.commands.begin(row, T0);
    const b = await store.commands.begin({ ...row, beginOffset: 99 }, T0 + 1);
    expect(a).toMatchObject({ state: "pending", beginOffset: 42 });
    expect(b.beginOffset).toBe(42);
    await store.commands.finish(row.commandId, { state: "landed", updateId: "1220" + "ab".repeat(32) });
    await store.commands.finish(row.commandId, { state: "failed", diagnosis: { kind: "unknown", retryable: true, technical: "late" } });
    expect(await store.commands.get(row.commandId)).toMatchObject({ state: "landed", updateId: "1220" + "ab".repeat(32) });
    await store.commands.begin({ ...row, commandId: "claim:x" }, T0);
    await store.commands.finish("claim:x", { state: "failed", diagnosis: { kind: "not-settled", retryable: false, technical: "t" } });
    expect(await store.commands.get("claim:x")).toMatchObject({ state: "failed", diagnosis: { kind: "not-settled" } });
  });
});
