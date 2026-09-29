import { describe, expect, it } from "vitest";
import { backlogRows, oracleRows } from "./rows-canton";

const NOW = 1_790_000_100;

describe("Canton status rows", () => {
  it("grades each oracle by its newest close: fresh, late, silent", () => {
    const rows = oracleRows(
      [
        { oracle: "agari-oracle-coinbase-r1::1220aa", last_boundary_sec: String(NOW - 40), last_recorded_sec: String(NOW - 29), recent_boundaries: 10 },
        { oracle: "agari-oracle-kraken-r1::1220bb", last_boundary_sec: String(NOW - 150), last_recorded_sec: String(NOW - 139), recent_boundaries: 8 },
        { oracle: "agari-oracle-bitstamp-r1::1220cc", last_boundary_sec: null, last_recorded_sec: null, recent_boundaries: 0 },
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
