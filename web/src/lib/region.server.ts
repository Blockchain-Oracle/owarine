import { visitorCountry } from "./geo/visitor-country.server";
import { isRestrictedCountry, REGION_HEADER, RESTRICTED } from "./region-mark";

/**
 * The server half of the geofence (D-095): every funded route answers this before it touches a key,
 * a balance or a co-signature. Reads never call it.
 */

/**
 * The proxy's mark first, because it already holds the country list. The visitor's country (`visitorCountry`) and
 * the local override are kept as a fallback so a route stays enforced even if the matcher ever stops covering it.
 * No header and no override means open — local development and ops see the venue unchanged.
 */
export function regionRestricted(req: Request): boolean {
  if (req.headers.get(REGION_HEADER) === RESTRICTED) return true;
  if (isRestrictedCountry(process.env.AGARI_REGION_OVERRIDE)) return true;
  return isRestrictedCountry(visitorCountry(req));
}

/** 451 Unavailable For Legal Reasons — the venue's whole answer to a funded call from a held region. */
export function regionRestrictedResponse(): Response {
  return Response.json({ error: "region_restricted" }, { status: 451, headers: { "Cache-Control": "no-store" } });
}

/**
 * C5d (C-MKT-08): on Canton every entry a seat makes goes through this server — a call's quote and accept, a resting
 * call and its placement, a ticket's accept, a Canton Coin deposit, an agent vault's open or fund — so each holds the
 * way the faucet does. Exits (exit quotes, claims, stale refunds, cancels, cash-outs, withdrawals, the seat's reset)
 * never ask, so a held reader can always leave.
 */
export function regionHold(req: Request): Response | null {
  return regionRestricted(req) ? regionRestrictedResponse() : null;
}
