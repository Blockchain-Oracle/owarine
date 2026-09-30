import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countryForIp, resetCountryDbForTests } from "./country-db.server";
import { visitorCountry } from "./visitor-country.server";

const req = (headers: Record<string, string>) => new Request("http://app.internal/", { headers });

describe("the visitor's country without a CDN header (K-003)", () => {
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "geo-"));
    const path = join(dir, "db.csv.gz");
    writeFileSync(path, gzipSync("3.0.0.0,3.255.255.255,US\n81.2.69.0,81.2.69.255,GB\n"));
    vi.stubEnv("AGARI_GEOIP_DB", path);
    resetCountryDbForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetCountryDbForTests();
  });

  it("behind Traefik, reads the local table over Traefik's own hop and ignores a forged Vercel header", () => {
    vi.stubEnv("TRUSTED_PROXY", "forwarded");
    expect(visitorCountry(req({ "x-forwarded-for": "3.1.2.3" }))).toBe("US");
    expect(visitorCountry(req({ "x-forwarded-for": "3.1.2.3", "x-vercel-ip-country": "GB" }))).toBe("US");
    expect(visitorCountry(req({ "x-forwarded-for": "3.1.2.3, 81.2.69.1" }))).toBe("GB");
  });

  it("on Vercel, keeps the reference's header", () => {
    vi.stubEnv("TRUSTED_PROXY", "vercel");
    expect(visitorCountry(req({ "x-vercel-ip-country": "US", "x-forwarded-for": "81.2.69.1" }))).toBe("US");
  });

  it("with no database, answers null and warns once", () => {
    vi.stubEnv("AGARI_GEOIP_DB", "/nonexistent/db.csv.gz");
    resetCountryDbForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(countryForIp("3.1.2.3")).toBeNull();
    expect(countryForIp("3.1.2.4")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
