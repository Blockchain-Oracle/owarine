/**
 * The seat link SQL against a real Postgres (skipped unless SEAT_PG_URL is set), as `seat-store.server.test.ts`:
 *
 *   SEAT_PG_URL=postgres://… pnpm --filter web exec vitest run src/lib/seat-link-store.server.test.ts
 */
import { getDb, seatPartyFor } from "@agari/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SEAT_LINK_CONFIRM_MS } from "@agari/markets";
import { leasedAddresses } from "./agents.server";
import { LINK_CODE_MAX_FAILURES } from "./seat-link-store.server";
import { createSeatStore, DEFAULT_RULES } from "./seat-store.server";

const URL_ = process.env.SEAT_PG_URL;
const PARTIES = ["seat-1::1220aa", "seat-2::1220bb"];
const T0 = 1_790_000_000_000;
const TTL = 60_000;

describe.skipIf(!URL_)("seat link store (Postgres)", () => {
  if (URL_) process.env.DATABASE_URL = URL_;
  const db = getDb()!;
  let store: ReturnType<typeof createSeatStore>;
  const lease = async (address: string, now = T0) => {
    const out = await store.lease(address, now, { startOffset: 1, leaseId: randomUUID(), rules: DEFAULT_RULES });
    if (out.kind !== "leased") throw new Error("expected a lease");
    return out.lease;
  };

  beforeEach(async () => {
    await db.unsafe("DROP TABLE IF EXISTS seat_pool, seat_leases, seat_waitlist, seat_commands, seat_link_codes, seat_linked_keys");
    store = createSeatStore(db, PARTIES);
    await store.ready();
  });
  afterAll(() => db.end());

  /** The holder's device allows the key that claimed its code (C4c, review L1). */
  const join = async (leaseId: string, code: string, key: string, at: number) => {
    expect(await store.links.redeem(code, key, at)).toEqual({ kind: "pending", leaseId });
    expect(await store.links.decide(code, leaseId, true, at + 1)).toBe("linked");
  };

  it("joins a second key to the lease once, and only when the holder allows it; the code never works again", async () => {
    const held = await lease("web-key");
    expect(await store.links.issue(held.leaseId, "K7M2QF4H", T0, TTL)).toBe(true);
    expect(await store.links.issue(held.leaseId, "K7M2QF4H", T0, TTL)).toBe(false);
    expect(await store.links.redeem("K7M2QF4H", "phone-key", T0 + 1_000)).toEqual({ kind: "pending", leaseId: held.leaseId });
    // Claimed, not joined: the key maps to nothing until the holder's device allows it.
    expect(await store.byAddress("phone-key")).toBeNull();
    expect(await seatPartyFor(db, "phone-key")).toBeNull();
    expect(await store.links.codeState("K7M2QF4H", held.leaseId, T0 + 1_200)).toEqual({ state: "pending", device: "phone-key" });
    expect(await store.links.claimState("K7M2QF4H", "phone-key", T0 + 1_200)).toBe("pending");
    expect(await store.links.decide("K7M2QF4H", held.leaseId, true, T0 + 1_400)).toBe("linked");
    expect(await store.links.claimState("K7M2QF4H", "phone-key", T0 + 1_500)).toBe("linked");
    expect(await store.byAddress("phone-key")).toMatchObject({ leaseId: held.leaseId, party: held.party, address: "web-key" });
    expect(await store.byAddress("web-key")).toMatchObject({ leaseId: held.leaseId });
    expect(await store.links.isLinked("phone-key", held.leaseId)).toBe(true);
    expect(await store.links.codeState("K7M2QF4H", held.leaseId, T0 + 1_500)).toMatchObject({ state: "linked" });
    expect(await store.links.redeem("K7M2QF4H", "third-key", T0 + 2_000)).toEqual({ kind: "invalid" });
    expect(await store.byAddress("third-key")).toBeNull();
  });

  it("C4c L1: a refused or unanswered claim never maps, and a late answer is refused", async () => {
    const held = await lease("web-key");
    await store.links.issue(held.leaseId, "DECLINE1", T0, TTL);
    await store.links.redeem("DECLINE1", "thief-key", T0 + 1);
    expect(await store.links.decide("DECLINE1", held.leaseId, false, T0 + 2)).toBe("declined");
    expect(await store.links.claimState("DECLINE1", "thief-key", T0 + 3)).toBe("declined");
    expect(await store.links.codeState("DECLINE1", held.leaseId, T0 + 3)).toMatchObject({ state: "declined" });
    expect(await store.byAddress("thief-key")).toBeNull();
    // A second answer changes nothing.
    expect(await store.links.decide("DECLINE1", held.leaseId, true, T0 + 4)).toBe("gone");
    expect(await store.byAddress("thief-key")).toBeNull();

    await store.links.issue(held.leaseId, "TIMEOUT1", T0, TTL);
    await store.links.redeem("TIMEOUT1", "slow-key", T0 + 10);
    const late = T0 + 10 + SEAT_LINK_CONFIRM_MS;
    expect(await store.links.claimState("TIMEOUT1", "slow-key", late)).toBe("expired");
    expect(await store.links.codeState("TIMEOUT1", held.leaseId, late)).toEqual({ state: "expired", device: null });
    expect(await store.links.decide("TIMEOUT1", held.leaseId, true, late)).toBe("gone");
    expect(await store.byAddress("slow-key")).toBeNull();
    // Another seat's holder cannot answer this seat's claim.
    const other = await lease("other-key", T0 + 20);
    await store.links.issue(held.leaseId, "FOREIGN1", T0 + 20, TTL);
    await store.links.redeem("FOREIGN1", "tablet-key", T0 + 21);
    expect(await store.links.decide("FOREIGN1", other.leaseId, true, T0 + 22)).toBe("gone");
    expect(await store.byAddress("tablet-key")).toBeNull();
  });

  it("C4c L1: wrong guesses from anywhere lock every code live while they arrive", async () => {
    const held = await lease("web-key");
    await store.links.issue(held.leaseId, "RIGHTONE", T0, TTL);
    for (let i = 0; i < LINK_CODE_MAX_FAILURES; i += 1) expect(await store.links.redeem(`WRONG${String(i).padStart(3, "0")}`, `guesser-${i}`, T0 + 1 + i)).toEqual({ kind: "invalid" });
    // The right code, now: locked, one answer for everything, and the holder's screen shows it expired.
    expect(await store.links.redeem("RIGHTONE", "phone-key", T0 + 100)).toEqual({ kind: "invalid" });
    expect(await store.links.codeState("RIGHTONE", held.leaseId, T0 + 101)).toEqual({ state: "expired", device: null });
    // A code shown after the guesses starts clean.
    await store.links.issue(held.leaseId, "FRESHONE", T0 + 200, TTL);
    await join(held.leaseId, "FRESHONE", "phone-key", T0 + 201);
    expect(await store.byAddress("phone-key")).toMatchObject({ leaseId: held.leaseId });
  });

  it("refuses an expired or unknown code, and a key that holds a seat of its own", async () => {
    const held = await lease("web-key");
    await store.links.issue(held.leaseId, "AAAAAA", T0, TTL);
    expect(await store.links.codeState("AAAAAA", held.leaseId, T0 + 1)).toEqual({ state: "showing", device: null });
    expect(await store.links.redeem("AAAAAA", "phone-key", T0 + TTL)).toEqual({ kind: "invalid" });
    expect(await store.links.codeState("AAAAAA", held.leaseId, T0 + TTL)).toEqual({ state: "expired", device: null });
    expect(await store.links.codeState("AAAAAA", "00000000-0000-0000-0000-000000000000", T0)).toBeNull();
    expect(await store.links.redeem("BBBBBB", "phone-key", T0)).toEqual({ kind: "invalid" });
    await lease("phone-key");
    await store.links.issue(held.leaseId, "CCCCCC", T0, TTL);
    expect(await store.links.redeem("CCCCCC", "phone-key", T0 + 1)).toEqual({ kind: "own-seat" });
    expect(await store.links.issuedSince(held.leaseId, T0)).toBe(2);
  });

  it("ends with the lease: a released seat's code and joined key stop working; unlink takes only the joined key off", async () => {
    const held = await lease("web-key");
    await store.links.issue(held.leaseId, "DDDDDD", T0, TTL);
    await join(held.leaseId, "DDDDDD", "phone-key", T0 + 1);
    expect(await store.links.unlink("phone-key")).toBe(true);
    expect(await store.byAddress("phone-key")).toBeNull();
    expect(await store.byAddress("web-key")).toMatchObject({ leaseId: held.leaseId });
    await store.links.issue(held.leaseId, "EEEEEE", T0, TTL);
    await join(held.leaseId, "EEEEEE", "phone-key", T0 + 2);
    await store.links.issue(held.leaseId, "FFFFFF", T0, TTL);
    await store.release(held.leaseId, T0 + 3, "released");
    expect(await store.byAddress("phone-key")).toBeNull();
    expect(await store.links.redeem("FFFFFF", "tablet-key", T0 + 4)).toEqual({ kind: "invalid" });
  });

  it("C4c: the web and ops read one resolution; a recycled seat never maps an old device, and seat A's key never maps to B", async () => {
    const a = await lease("web-a");
    const b = await lease("web-b", T0 + 1);
    await store.links.issue(a.leaseId, "GGGGGG", T0, TTL);
    await join(a.leaseId, "GGGGGG", "phone-a", T0 + 2);
    // `byAddress` (the web's seat check, desk, push, index, Lucky) and ops' `seatPartyFor` agree on every key.
    for (const [key, party] of [["web-a", a.party], ["phone-a", a.party], ["web-b", b.party]] as const) {
      expect((await store.byAddress(key))?.party).toBe(party);
      expect(await seatPartyFor(db, key)).toBe(party);
    }
    // The registry labels a seat by the key that took it; the calling device's own key labels its own party.
    expect(await leasedAddresses()).toEqual(new Map([[a.party, "web-a"], [b.party, "web-b"]]));
    expect((await leasedAddresses({ party: a.party, address: "phone-a" })).get(a.party)).toBe("phone-a");

    await store.release(a.leaseId, T0 + 3, "released");
    expect(await seatPartyFor(db, "phone-a")).toBeNull();
    expect(await store.byAddress("phone-a")).toBeNull();
    expect((await store.byAddress("web-b"))?.party).toBe(b.party);
    // Seat A drains and frees; its party goes to the next visitor as a new lease. Neither old key maps to it.
    expect(await store.markFree(a.party, T0 + 4)).toBe(true);
    const c = await lease("web-c", T0 + 5);
    expect(c.party).toBe(a.party);
    for (const old of ["web-a", "phone-a"]) {
      expect(await store.byAddress(old)).toBeNull();
      expect(await seatPartyFor(db, old)).toBeNull();
    }
    expect(await leasedAddresses()).toEqual(new Map([[a.party, "web-c"], [b.party, "web-b"]]));
  });
});
