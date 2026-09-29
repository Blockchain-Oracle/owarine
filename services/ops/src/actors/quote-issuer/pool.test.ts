import { describe, expect, it } from "vitest";
import type { Active, VenueCashC } from "@agari/markets/ops/canton";
import { PoolBusyError, ShardPool } from "./pool";

const V = "venue::1220ab";
const cash = (cid: string, amount: bigint, over: Partial<VenueCashC> = {}): Active<VenueCashC> => ({ cid, data: { venue: V, owner: V, amount, bucket: "shard", ...over } });

describe("shard pool", () => {
  it("rebuilds from the ledger, taking only the venue's own trading cash", () => {
    const pool = new ShardPool({ venue: V });
    pool.sync([cash("a", 100n), cash("b", 50n), cash("u", 10n, { owner: "user::1220cd" }), cash("r", 10n, { bucket: "reserve:lp" })]);
    expect(pool.stats()).toMatchObject({ free: 2, totalBase: 150n });
  });

  it("leases the smallest shard that covers the stake, and never the same shard twice", async () => {
    const pool = new ShardPool({ venue: V, maxWaitMs: 20 });
    pool.sync([cash("big", 1000n), cash("mid", 100n), cash("small", 10n)]);
    expect((await pool.lease(50n, "q1")).cid).toBe("mid");
    expect((await pool.lease(50n, "q2")).cid).toBe("big");
    await expect(pool.lease(50n, "q3")).rejects.toBeInstanceOf(PoolBusyError);
    expect((await pool.lease(5n, "q4")).cid).toBe("small");
  });

  it("hands a returned shard to the first waiter, and adds the landed command's change", async () => {
    const pool = new ShardPool({ venue: V, maxWaitMs: 1_000 });
    pool.sync([cash("a", 100n)]);
    const first = await pool.lease(60n, "q1");
    const waiting = pool.lease(30n, "q2");
    pool.complete([first], new Set(["a"]), [cash("change", 40n)]);
    expect((await waiting).cid).toBe("change");
    expect(pool.stats()).toMatchObject({ free: 0, inflight: 1 });
  });

  it("frees on a definite rejection, drops a shard the ledger says is gone, and never resurrects a consumed one", async () => {
    const pool = new ShardPool({ venue: V });
    pool.sync([cash("a", 100n), cash("b", 100n)]);
    const a = await pool.lease(1n, "q");
    pool.release([a]);
    const again = await pool.lease(1n, "q");
    pool.release([again], new Set([again.cid]));
    expect(pool.stats().free).toBe(1);
    // A snapshot read before the consuming write still lists the shard: it stays gone.
    pool.sync([cash("a", 100n), cash("b", 100n)]);
    expect(pool.all().map((s) => s.cid)).toEqual([again.cid === "a" ? "b" : "a"]);
  });

  it("quarantines on an unknown outcome until the completion is known", async () => {
    const pool = new ShardPool({ venue: V });
    pool.sync([cash("a", 100n), cash("b", 100n)]);
    const a = await pool.lease(1n, "q");
    pool.quarantine([a], "quote:x", 5);
    expect(pool.quarantined().map((s) => [s.cid, s.commandId, s.beginOffset])).toEqual([[a.cid, "quote:x", 5]]);
    pool.sync([cash("a", 100n), cash("b", 100n)]);
    expect(pool.stats()).toMatchObject({ free: 1, quarantined: 1 });
    pool.unquarantine(a.cid, false);
    expect(pool.stats()).toMatchObject({ free: 2, quarantined: 0 });
  });
});
