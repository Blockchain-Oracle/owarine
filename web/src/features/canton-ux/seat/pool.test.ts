import type { SeatLeaseView } from "@owarine/markets";
import { describe, expect, it } from "vitest";
import { POOL_SPAN_SEC, poolFullOf, takeOutcomeOf } from "./pool";

const full = (over: Partial<Extract<SeatLeaseView, { kind: "pool-full" }>> = {}): Extract<SeatLeaseView, { kind: "pool-full" }> => ({ kind: "pool-full", total: 8, inUse: 8, nextFreeAtMs: 1_700_000_012_400, position: 3, ...over });

describe("what a Take a seat answer means", () => {
  it("a full pool is waiting, not a seat and not a failure", () => {
    expect(takeOutcomeOf(full())).toBe("waiting");
  });

  it("a leased party is a seat", () => {
    const leased: SeatLeaseView = { kind: "leased", leaseId: "l-1", address: "addr", party: "seat-3::1220ab", leasedAtMs: 1, idleExpiresAtMs: 2, hardCapAtMs: 3, openLegs: 0, funded: true };
    expect(takeOutcomeOf(leased)).toBe("seated");
  });

  it("no party and no place in line is unseated, and so is no answer", () => {
    expect(takeOutcomeOf({ kind: "none" })).toBe("unseated");
    expect(takeOutcomeOf(null)).toBe("unseated");
  });
});

describe("the pool-full plate's facts", () => {
  it("rounds the next free seat up to a whole second against the 15-minute ring", () => {
    expect(poolFullOf(full())).toEqual({ atSec: 1_700_000_013, spanSec: POOL_SPAN_SEC, ahead: 3 });
  });

  it("is never fewer than one ahead, and has no time until the venue names one", () => {
    expect(poolFullOf(full({ position: 0, nextFreeAtMs: null }))).toEqual({ atSec: null, spanSec: POOL_SPAN_SEC, ahead: 1 });
  });
});
