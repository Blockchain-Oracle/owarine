import { describe, expect, it } from "vitest";
import { toAddress } from "@agari/core/types";
import { mintSeatCookie, readSeatCookie, SEAT_COOKIE, SEAT_COOKIE_TTL_MS, seatCookieFrom } from "./seat-cookie.server";

const SECRET = "s".repeat(40);
const ADDRESS = toAddress("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T");
const LEASE = "0b6f3a7e-58a1-4d4e-9b1a-2f1f6c1f0a11";
const NOW = 1_790_000_000_000;

describe("seat cookie", () => {
  it("round-trips a lease id and address with its expiry", () => {
    const { value, expiresAtMs } = mintSeatCookie(SECRET, LEASE, ADDRESS, NOW);
    expect(value.split(".")).toHaveLength(4);
    expect(expiresAtMs).toBe(NOW + SEAT_COOKIE_TTL_MS);
    expect(readSeatCookie(SECRET, value, NOW + 1_000)).toEqual({ leaseId: LEASE, address: ADDRESS, expiresAtMs });
  });

  it("refuses another secret, an edited field, an expired value and junk", () => {
    const { value } = mintSeatCookie(SECRET, LEASE, ADDRESS, NOW);
    expect(readSeatCookie("t".repeat(40), value, NOW)).toBeNull();
    const [lease, address, expiry, mac] = value.split(".") as [string, string, string, string];
    expect(readSeatCookie(SECRET, [lease, address, String(Number(expiry) + 1), mac].join("."), NOW)).toBeNull();
    expect(readSeatCookie(SECRET, [lease.replace("0b6f", "0b6e"), address, expiry, mac].join("."), NOW)).toBeNull();
    expect(readSeatCookie(SECRET, [lease, "11111111111111111111111111111111", expiry, mac].join("."), NOW)).toBeNull();
    expect(readSeatCookie(SECRET, value, NOW + SEAT_COOKIE_TTL_MS)).toBeNull();
    for (const junk of ["", "a.b.c", "a.b.c.d.e", `${LEASE}.${ADDRESS}.x.${mac}`, null, undefined]) expect(readSeatCookie(SECRET, junk, NOW)).toBeNull();
  });

  it("finds the seat cookie in a Cookie header among others", () => {
    const { value } = mintSeatCookie(SECRET, LEASE, ADDRESS, NOW);
    const headers = new Headers({ cookie: `agari.region=ok; ${SEAT_COOKIE}=${encodeURIComponent(value)}; theme=dark` });
    expect(seatCookieFrom(headers)).toBe(value);
    expect(seatCookieFrom(new Headers({ cookie: "theme=dark" }))).toBeNull();
  });
});
