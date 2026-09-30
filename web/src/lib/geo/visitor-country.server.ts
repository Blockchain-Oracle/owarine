import { clientIp } from "@/lib/client-ip.server";
import { COUNTRY_HEADER } from "@/lib/region-mark";
import { countryForIp } from "./country-db.server";

/**
 * The visitor's country for the region hold (D-095, K-003).
 *
 * A CDN's country header is believed only when that CDN is the named proxy: on Coolify behind Traefik anyone can send
 * `x-vercel-ip-country: GB`, so there the country comes from the local DB-IP table over the trusted client address.
 */
export function visitorCountry(request: Request): string | null {
  const proxy = (process.env.TRUSTED_PROXY ?? (process.env.VERCEL === "1" ? "vercel" : "")).trim().toLowerCase();
  if (proxy === "vercel") return request.headers.get(COUNTRY_HEADER);
  if (proxy === "cloudflare") return request.headers.get("cf-ipcountry") ?? countryForIp(clientIp(request));
  return countryForIp(clientIp(request));
}
