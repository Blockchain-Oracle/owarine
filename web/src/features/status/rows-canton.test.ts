import { describe, expect, it } from "vitest";
import { backlogRows, oracleRows } from "./rows-canton";

const NOW = 1_790_000_100;

describe("Canton status rows", () => {
  it("grades each oracle by its newest close: fresh, late, silent", () => {
    const rows = oracleRows(
      [
        { oracle: "owarine-oracle-coinbase-r1::1220aa", last_boundary_sec: String(NOW - 40), last_recorded_sec: String(NOW - 29), recent_boundaries: 10 },
        { oracle: "owarine-oracle-kraken-r1::1220bb", last_boundary_sec: String(NOW - 150), last_recorded_sec: String(NOW - 139), recent_boundaries: 8 },
        { oracle: "owarine-oracle-bitstamp-r1::1220cc", last_boundary_sec: null, last_recorded_sec: null, recent_boundaries: 0 },
      ],
      NOW,
    );
    expect(rows.map((r) => [r.id, r.ok, r.grade])).toEqual([
      ["oracle:coinbase", true, "good"],
      ["oracle:kraken", true, "warn"],
      ["oracle:bitstamp", false, null],
    ]);
    expect(rows[0]!.label).toBe("Oracle · Coinbase freshness");
    expect(rows[0]!.detail).toContain("T + 11s");
    expect(oracleRows([], NOW)[0]!.ok).toBe(false);
  });

  it("keeps the resolver and settler backlogs green only when empty, red past five minutes", () => {
    const clear = backlogRows({ unresolved: 0, oldest_unresolved_deadline_sec: null, unsettled: 0, oldest_unsettled_resolved_sec: null }, NOW);
    expect(clear.map((r) => r.grade)).toEqual(["good", "good"]);
    const stuck = backlogRows({ unresolved: 2, oldest_unresolved_deadline_sec: String(NOW - 400), unsettled: 1, oldest_unsettled_resolved_sec: String(NOW - 90) }, NOW);
    expect(stuck.map((r) => [r.id, r.ok, r.grade])).toEqual([
      ["backlog:resolver", false, null],
      ["backlog:settler", true, "warn"],
    ]);
  });
});

describe("guest seat pool row (C9d)", () => {
  const NOW_MS = 1_790_000_000_000;
  const base = { total: 6, free: 2, leased: 3, draining: 1, oldestDrainingSinceMs: NOW_MS - 190_000, oldestDrainingNote: "1 leg", waitlist: 0 };

  it("counts the pool as the table has it, and says what the longest-draining seat holds", async () => {
    const { seatPoolRow } = await import("./rows-canton");
    const row = seatPoolRow(base, NOW_MS);
    expect(row).toMatchObject({ id: "seats", ok: true, grade: "good" });
    expect(row.detail).toBe("6 seats · 2 free · 3 leased · 1 draining · longest draining 3m 10s, holds 1 leg");
  });

  it("turns amber when no seat is free and names the waiting visitors", async () => {
    const { seatPoolRow } = await import("./rows-canton");
    const row = seatPoolRow({ ...base, free: 0, leased: 5, waitlist: 2 }, NOW_MS);
    expect(row).toMatchObject({ ok: true, grade: "warn" });
    expect(row.detail).toContain("2 visitors waiting");
  });

  it("turns amber when a draining seat's checks have been failing for over five minutes", async () => {
    const { seatPoolRow } = await import("./rows-canton");
    expect(seatPoolRow({ ...base, oldestDrainingSinceMs: NOW_MS - 6 * 60_000, oldestDrainingNote: "check failed: ledger down" }, NOW_MS).grade).toBe("warn");
    // Holding a leg for an hour is normal (it waits on settlement): still good while seats are free.
    expect(seatPoolRow({ ...base, oldestDrainingSinceMs: NOW_MS - 3_600_000 }, NOW_MS).grade).toBe("good");
  });

  it("is red with no seat at all, and reads a pool with none draining plainly", async () => {
    const { seatPoolRow } = await import("./rows-canton");
    expect(seatPoolRow({ ...base, total: 0, free: 0, leased: 0, draining: 0 }, NOW_MS).ok).toBe(false);
    expect(seatPoolRow({ ...base, draining: 0, free: 3, oldestDrainingSinceMs: null, oldestDrainingNote: null }, NOW_MS).detail).toBe("6 seats · 3 free · 3 leased · 0 draining");
  });
});
