import { describe, expect, it } from "vitest";
import { readCcRailEnv } from "./env";

describe("the Canton Coin rail's configuration (C7b)", () => {
  it("defaults to a fixed, stated rate of 100000 cash units per coin, and to off everything that moves value", () => {
    const c = readCcRailEnv({});
    expect(c.unitsPerCoin).toBe(100_000n);
    expect(c.listingId).toBe("cc-1");
    expect(c.instrumentId).toBe("Amulet");
    expect(c.registryUrl).toBeNull();
    expect(c.createListing).toBe(false);
    expect(c.requireLease).toBe(true);
    expect(c.minDepositUnits).toBe(100_000n);
    expect(c.maxDepositUnits).toBe(1_000_000_000n);
  });

  it("refuses a rate that would force rounding, and bounds that cross", () => {
    expect(() => readCcRailEnv({ CC_UNITS_PER_COIN: "3" })).toThrow(/divide 10\^10/);
    expect(() => readCcRailEnv({ CC_UNITS_PER_COIN: "0" })).toThrow();
    expect(() => readCcRailEnv({ CC_UNITS_PER_COIN: "1e5" })).toThrow(/integer/);
    expect(() => readCcRailEnv({ CC_MIN_DEPOSIT_UNITS: "10", CC_MAX_DEPOSIT_UNITS: "9" })).toThrow(/at most/);
    expect(() => readCcRailEnv({ CC_MIN_DEPOSIT_UNITS: "0" })).toThrow();
  });

  it("reads a configured rail", () => {
    const c = readCcRailEnv({
      CC_LISTING_ID: "cc-2", CC_INSTRUMENT_ADMIN: "dso::1220", CC_INSTRUMENT_ID: "USDCx", CC_UNITS_PER_COIN: "1000000", CC_REGISTRY_URL: "https://scan.example",
      CC_ALLOWED_PACKAGE_IDS: "aa, bb ,", CC_CREATE_LISTING: "1", CC_REQUIRE_LEASE: "0", CC_REFUND_AFTER_SEC: "60",
    });
    expect(c).toMatchObject({ listingId: "cc-2", instrumentAdmin: "dso::1220", instrumentId: "USDCx", unitsPerCoin: 1_000_000n, registryUrl: "https://scan.example", allowedPackageIds: ["aa", "bb"], createListing: true, requireLease: false, refundAfterSec: 60 });
  });
});
