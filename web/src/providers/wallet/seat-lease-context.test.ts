import { describe, expect, it } from "vitest";
import { leasedAddressOf, seatNumberOf } from "./seat-lease-context";

const leased = { kind: "leased", leaseId: "l1", address: "Seat1", party: "seat-1::1220ab", leasedAtMs: 0, idleExpiresAtMs: 1, hardCapAtMs: 2, openLegs: 0, funded: true } as const;

describe("leasedAddressOf (C4c.2: no lease, no seat-row read)", () => {
  it("passes the address through while this device holds a lease", () => {
    expect(leasedAddressOf(leased, "Seat1")).toBe("Seat1");
  });
  it("passes a joined device's own key through: the server answered it leased, and resolves that key to the seat (C11b)", () => {
    expect(leasedAddressOf(leased, "JoinedPhoneKey")).toBe("JoinedPhoneKey");
  });
  it("is null with no answer yet, no lease, a full pool or no key", () => {
    expect(leasedAddressOf(null, "Seat1")).toBeNull();
    expect(leasedAddressOf({ kind: "none" }, "Seat1")).toBeNull();
    expect(leasedAddressOf({ kind: "pool-full", total: 8, inUse: 8, nextFreeAtMs: null, position: 1 }, "Seat1")).toBeNull();
    expect(leasedAddressOf(leased, null)).toBeNull();
  });
});

describe("seatNumberOf (C11b: every network's seat hint names its number)", () => {
  it("reads the bare user name, the DevNet Console hint and the local bootstrap hint", () => {
    expect(seatNumberOf("seat-3::1220abcd")).toBe(3);
    expect(seatNumberOf("pm-seat-3::1220abcd")).toBe(3);
    expect(seatNumberOf("pm-seat-12::1220abcd")).toBe(12);
    expect(seatNumberOf("owarine-user-seat-1-k2x9::1220abcd")).toBe(1);
  });
  it("is null where the hint carries no seat number", () => {
    expect(seatNumberOf("seat-a-lk2::1220abcd")).toBeNull();
    expect(seatNumberOf("pm-venue::1220abcd")).toBeNull();
    expect(seatNumberOf("pm-seat3x::1220abcd")).toBeNull();
  });
});
