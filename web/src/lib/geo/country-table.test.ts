import { describe, expect, it } from "vitest";
import { buildCountryTable, lookupCountry, parseIp, parseIpv6 } from "./country-table";

const CSV = [
  "0.0.0.0,0.255.255.255,ZZ",
  "1.0.0.0,1.0.0.255,AU",
  "3.0.0.0,3.255.255.255,US",
  "81.2.69.0,81.2.69.255,GB",
  "::,1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff,ZZ",
  "2001:db8::,2001:db8:ffff:ffff:ffff:ffff:ffff:ffff,US",
  "2a00:1450::,2a00:1450:ffff:ffff:ffff:ffff:ffff:ffff,IE",
  "not,a,line",
].join("\n");

describe("the DB-IP Lite country table (K-003)", () => {
  const table = buildCountryTable(CSV);

  it("finds IPv4 inside a range and nothing in a gap", () => {
    expect(lookupCountry(table, "3.4.5.6")).toBe("US");
    expect(lookupCountry(table, "81.2.69.160")).toBe("GB");
    expect(lookupCountry(table, "1.0.0.0")).toBe("AU");
    expect(lookupCountry(table, "1.0.0.255")).toBe("AU");
    expect(lookupCountry(table, "2.0.0.1")).toBeNull();
  });

  it("finds IPv6, and reads an IPv4-mapped address as IPv4", () => {
    expect(lookupCountry(table, "2001:db8::1")).toBe("US");
    expect(lookupCountry(table, "2a00:1450:4009:81f::200e")).toBe("IE");
    expect(lookupCountry(table, "::ffff:3.1.1.1")).toBe("US");
    expect(lookupCountry(table, "[2001:db8::2]")).toBe("US");
  });

  it("never names a country for reserved space or junk", () => {
    expect(lookupCountry(table, "0.1.2.3")).toBeNull();
    expect(lookupCountry(table, "::1")).toBeNull();
    expect(lookupCountry(table, "local-development")).toBeNull();
    expect(lookupCountry(table, "999.1.1.1")).toBeNull();
    expect(parseIp("1:2:3")).toBeNull();
  });

  it("parses the IPv6 forms", () => {
    expect(parseIpv6("::")).toBe(0n);
    expect(parseIpv6("::1")).toBe(1n);
    expect(parseIpv6("1::")).toBe(1n << 112n);
    expect(parseIpv6("::ffff:1.2.3.4")).toBe((0xffffn << 32n) | 0x01020304n);
    expect(parseIpv6("1:2:3:4:5:6:7:8:9")).toBeNull();
  });
});
