import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, ipBucket, publicOrigin, rateLimitKey } from "./client-ip.server";

const req = (headers: Record<string, string>) => new Request("http://app.internal:3000/api/x", { headers });

describe("clientIp behind the hosted proxy (TRUSTED_PROXY, K-003)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("forwarded: takes the entry Traefik appended, so a forged header never becomes the key", () => {
    vi.stubEnv("TRUSTED_PROXY", "forwarded");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({}))).toBeNull();
  });

  it("vercel and cloudflare keep the reference's first-hop rules", () => {
    vi.stubEnv("TRUSTED_PROXY", "vercel");
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    vi.stubEnv("TRUSTED_PROXY", "cloudflare");
    expect(clientIp(req({ "cf-connecting-ip": "198.51.100.2", "x-forwarded-for": "6.6.6.6" }))).toBe("198.51.100.2");
  });

  it("with no proxy named, production trusts no header and every limiter shares one bucket", () => {
    vi.stubEnv("TRUSTED_PROXY", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6" }))).toBeNull();
    expect(rateLimitKey(req({ "x-forwarded-for": "6.6.6.6" }))).toBe("unverified");
  });

  it("publicOrigin reads the proxy's scheme and host", () => {
    vi.stubEnv("TRUSTED_PROXY", "forwarded");
    expect(publicOrigin(req({ "x-forwarded-proto": "https", "x-forwarded-host": "pm.example" }))).toBe("https://pm.example");
  });
});

describe("ipBucket (C4c, review L1): one visitor's addresses share one limit", () => {
  it("counts an IPv6 address by its /64, however it is written", () => {
    const bucket = "2001:db8:85a3:12::/64";
    expect(ipBucket("2001:db8:85a3:12::1")).toBe(bucket);
    expect(ipBucket("2001:0db8:85a3:0012:ffff:1:2:3")).toBe(bucket);
    expect(ipBucket("[2001:db8:85a3:12:abcd::9]:443")).toBe(bucket);
    expect(ipBucket("2001:db8:85a3:12::1%en0")).toBe(bucket);
    expect(ipBucket("2001:db8:85a3:13::1")).not.toBe(bucket);
    expect(ipBucket("::1")).toBe("0:0:0:0::/64");
  });

  it("keeps an IPv4 address (mapped or not) and anything else as itself", () => {
    expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("local-development")).toBe("local-development");
    expect(ipBucket("unverified")).toBe("unverified");
  });
});
