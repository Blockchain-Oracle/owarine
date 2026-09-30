/**
 * The seat link SQL against a real Postgres (skipped unless SEAT_PG_URL is set), as `seat-store.server.test.ts`:
 *
 *   SEAT_PG_URL=postgres://… pnpm --filter web exec vitest run src/lib/seat-link-store.server.test.ts
 */
import { getDb, seatPartyFor } from "@agari/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { leasedAddresses } from "./agents.server";
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

  it("joins a second key to the lease once: it resolves to the same seat, and the code never works again", async () => {
    const held = await lease("web-key");
    expect(await store.links.issue(held.leaseId, "K7M2QF", T0, TTL)).toBe(true);
    expect(await store.links.issue(held.leaseId, "K7M2QF", T0, TTL)).toBe(false);
    expect(await store.links.redeem("K7M2QF", "phone-key", T0 + 1_000)).toEqual({ kind: "linked", leaseId: held.leaseId });
    expect(await store.byAddress("phone-key")).toMatchObject({ leaseId: held.leaseId, party: held.party, address: "web-key" });
    expect(await store.byAddress("web-key")).toMatchObject({ leaseId: held.leaseId });
    expect(await store.links.isLinked("phone-key", held.leaseId)).toBe(true);
    expect(await store.links.codeState("K7M2QF", held.leaseId, T0 + 1_500)).toBe("linked");
    expect(await store.links.redeem("K7M2QF", "third-key", T0 + 2_000)).toEqual({ kind: "invalid" });
    expect(await store.byAddress("third-key")).toBeNull();
  });

  it("refuses an expired or unknown code, and a key that holds a seat of its own", async () => {
    const held = await lease("web-key");
    await store.links.issue(held.leaseId, "AAAAAA", T0, TTL);
    expect(await store.links.codeState("AAAAAA", held.leaseId, T0 + 1)).toBe("showing");
    expect(await store.links.redeem("AAAAAA", "phone-key", T0 + TTL)).toEqual({ kind: "invalid" });
    expect(await store.links.codeState("AAAAAA", held.leaseId, T0 + TTL)).toBe("expired");
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
    await store.links.redeem("DDDDDD", "phone-key", T0 + 1);
    expect(await store.links.unlink("phone-key")).toBe(true);
    expect(await store.byAddress("phone-key")).toBeNull();
    expect(await store.byAddress("web-key")).toMatchObject({ leaseId: held.leaseId });
    await store.links.issue(held.leaseId, "EEEEEE", T0, TTL);
    await store.links.redeem("EEEEEE", "phone-key", T0 + 2);
    await store.links.issue(held.leaseId, "FFFFFF", T0, TTL);
    await store.release(held.leaseId, T0 + 3, "released");
    expect(await store.byAddress("phone-key")).toBeNull();
    expect(await store.links.redeem("FFFFFF", "tablet-key", T0 + 4)).toEqual({ kind: "invalid" });
  });

  it("C4c: the web and ops read one resolution; a recycled seat never maps an old device, and seat A's key never maps to B", async () => {
    const a = await lease("web-a");
    const b = await lease("web-b", T0 + 1);
    await store.links.issue(a.leaseId, "GGGGGG", T0, TTL);
    expect(await store.links.redeem("GGGGGG", "phone-a", T0 + 2)).toEqual({ kind: "linked", leaseId: a.leaseId });
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
