import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildCountryTable, lookupCountry, type CountryTable } from "./country-table";

/**
 * The region hold's country source on a host with no CDN header (K-003): DB-IP's IP-to-Country Lite, read from disk
 * once per process. `scripts/geo/fetch-dbip.mjs` downloads it (the web Dockerfile runs it at build); the file is
 * never committed. `AGARI_GEOIP_DB` names another path; the default is `data/geo/dbip-country-lite.csv.gz` under the
 * web process's working directory (`web/` for `next start`).
 *
 * No file means no country: the lookup answers null, the proxy treats the visitor as open, and a single warning says
 * so. `AGARI_REGION_OVERRIDE` still forces the held state for testing either way.
 */

export const DEFAULT_GEOIP_DB = "data/geo/dbip-country-lite.csv.gz";

/**
 * One table per process, held on `globalThis`: Next bundles `proxy.ts`, the route handlers and `instrumentation`
 * separately, and a module-level cache would load the 700k-line file once per bundle. Boot warms it
 * (`instrumentation-node.ts`) so no visitor's request pays the parse.
 */
const KEY = Symbol.for("agari.geo.countryTable");
const store = globalThis as { [KEY]?: CountryTable | null };

export function geoDbPath(env: Record<string, string | undefined> = process.env): string {
  const configured = env.AGARI_GEOIP_DB?.trim();
  const path = configured || DEFAULT_GEOIP_DB;
  return isAbsolute(path) ? path : join(process.cwd(), path);
}

function load(): CountryTable | null {
  const path = geoDbPath();
  if (!existsSync(path)) {
    console.warn(`[region] no IP-to-country database at ${path}; run scripts/geo/fetch-dbip.mjs. Visitors read as open.`);
    return null;
  }
  try {
    const raw = readFileSync(path);
    const text = path.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    const built = buildCountryTable(text);
    console.info(`[region] IP-to-country: ${built.v4Start.length} IPv4 and ${built.v6Code.length} IPv6 ranges from ${path}`);
    return built;
  } catch (error) {
    console.warn(`[region] could not read ${path}: ${error instanceof Error ? error.message : String(error)}. Visitors read as open.`);
    return null;
  }
}

/** The visitor's country from the local database, or null (no address, no database, reserved space). */
export function countryForIp(ip: string | null): string | null {
  if (!ip) return null;
  const table = warmCountryDb();
  return table ? lookupCountry(table, ip) : null;
}

/** Loads the table if this process has not yet; returns it, or null when there is no readable database. */
export function warmCountryDb(): CountryTable | null {
  if (store[KEY] === undefined) store[KEY] = load();
  return store[KEY] ?? null;
}

/** Tests only: forget the loaded table so the next lookup reads the path again. */
export function resetCountryDbForTests(): void {
  delete store[KEY];
}
