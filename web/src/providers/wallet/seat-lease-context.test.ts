import { describe, expect, it } from "vitest";
import { leasedAddressOf } from "./seat-lease-context";

const leased = { kind: "leased", leaseId: "l1", address: "Seat1", party: "seat-1::1220ab", leasedAtMs: 0, idleExpiresAtMs: 1, hardCapAtMs: 2, openLegs: 0, funded: true } as const;

describe("leasedAddressOf (C4c.2: no lease, no seat-row read)", () => {
  it("passes the address through only while that seat holds a lease", () => {
    expect(leasedAddressOf(leased, "Seat1")).toBe("Seat1");
  });
  it("is null with no answer yet, no lease, a full pool or another seat's lease", () => {
    expect(leasedAddressOf(null, "Seat1")).toBeNull();
    expect(leasedAddressOf({ kind: "none" }, "Seat1")).toBeNull();
    expect(leasedAddressOf({ kind: "pool-full", total: 8, inUse: 8, nextFreeAtMs: null, position: 1 }, "Seat1")).toBeNull();
    expect(leasedAddressOf(leased, "Seat2")).toBeNull();
    expect(leasedAddressOf(leased, null)).toBeNull();
  });
});
