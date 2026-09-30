import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, publicOrigin, rateLimitKey } from "./client-ip.server";

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
