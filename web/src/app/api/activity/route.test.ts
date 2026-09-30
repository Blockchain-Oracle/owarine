import { beforeEach, describe, expect, it, vi } from "vitest";

/** C13a: the inbox is the seat's own lease-scoped rows only for the seat itself; anyone else reads what it published. */
const ALICE = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const LEASE = { party: "agari-user-seat-1::1220aa", startOffset: 100 };
const caller = vi.fn<() => Promise<string | null>>();
const byAddress = vi.fn(async (_a: string) => LEASE as typeof LEASE | null);
const own = vi.fn(async () => ({ configured: true, items: [{ kind: "own" }], takes: [] }));
const published = vi.fn(async () => ({ configured: true, items: [{ kind: "published" }], takes: [] }));

vi.mock("@/lib/auth/seat-caller.server", () => ({ seatCaller: () => caller() }));
vi.mock("@/lib/ledger.server", () => ({ seatServer: () => ({ ok: true, server: { store: { byAddress } } }) }));
vi.mock("@/features/activity/feed.server", () => ({ ownInboxFeed: own, inboxFeed: published }));

const { GET } = await import("./route");
const get = () => GET(new Request(`http://localhost/api/activity?wallet=${ALICE}&sinceSec=5`));

describe("/api/activity inbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the seat itself reads its own rows under its current lease", async () => {
    caller.mockResolvedValue(ALICE);
    const body = await (await get()).json();
    expect(body.items).toEqual([{ kind: "own" }]);
    expect(own).toHaveBeenCalledWith(ALICE, { party: LEASE.party, fromOffset: LEASE.startOffset }, 5);
    expect(published).not.toHaveBeenCalled();
  });

  it("anyone else, or no proof, reads only what the seat published", async () => {
    for (const who of [null, "BobSeatAddress22222222222222222222222222222222"]) {
      caller.mockResolvedValue(who);
      expect((await (await get()).json()).items).toEqual([{ kind: "published" }]);
    }
    expect(own).not.toHaveBeenCalled();
  });

  it("a seat address with no lease reads the published view", async () => {
    caller.mockResolvedValue(ALICE);
    byAddress.mockResolvedValueOnce(null);
    expect((await (await get()).json()).items).toEqual([{ kind: "published" }]);
  });
});
