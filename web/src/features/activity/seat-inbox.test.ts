import { beforeEach, describe, expect, it, vi } from "vitest";

/** C13a (for C11a's push drain): a seat's phone hears its own calls, private included, under its lease only. */
const HOLDER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const fills = vi.fn(async () => [] as unknown[]);
const settlements = vi.fn(async () => [] as unknown[]);
const walletFills = vi.fn(async () => [] as unknown[]);
vi.mock("@agari/db", () => ({
  getDb: () => ({}),
  listTakes: async () => [],
  seatActivityReader: () => ({ fills, settlements }),
  socialActivityReader: () => ({ walletFills, walletSettlements: walletFills }),
}));

const { seatInboxFeed } = await import("./feed.server");

describe("seatInboxFeed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the leased party's own rows from the lease's start offset, never the published view", async () => {
    const feed = await seatInboxFeed(HOLDER as never, { party: "agari-user-seat-1::1220aa", startOffset: 100 }, 1_790_000_000);
    expect(feed.configured).toBe(true);
    const lease = { party: "agari-user-seat-1::1220aa", fromOffset: 100 };
    expect(fills).toHaveBeenCalledWith(HOLDER, lease, expect.objectContaining({ sinceSec: 1_790_000_000 }));
    expect(settlements).toHaveBeenCalledWith(HOLDER, lease, expect.objectContaining({ sinceSec: 1_790_000_000 }));
    expect(walletFills).not.toHaveBeenCalled();
  });
});
