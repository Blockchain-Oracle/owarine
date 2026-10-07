import { privateOpenRequestSchema } from "@owarine/core/private";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { openPrivate } from "@/features/private/canton.server";
import { gate } from "@/features/session/sponsor.server";
import { rateLimitKey } from "@/lib/client-ip.server";
import { regionRestricted, regionRestrictedResponse } from "@/lib/region.server";
import { jsonBody, seatFromRequest } from "@/lib/seat.server";

/**
 * Open a private call (C8d, L-39). The seat's lease says whose it is; the owner's signature over the exact bet (the
 * route rebuilds the message from the projection's own Window) says the owner meant this one. The call is the seat's
 * own firm quote from the venue, accepted with exactly its private cash and tagged private on the ledger; the command
 * id derives from the signature, so re-sending the same authorisation resumes it and never charges twice.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });
/** A refused open costs nothing, so opens are gated per owner and per address like the sponsor's calls. */
const OPENS_PER_OWNER_PER_HOUR = 20;
const OPENS_PER_IP_PER_HOUR = 60;

export async function POST(request: NextRequest) {
  // The geofence comes before any key, balance or quote (D-095).
  if (regionRestricted(request)) return regionRestrictedResponse();
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const parsed = privateOpenRequestSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return refuse(400, "malformed private open request");
  const nowMs = Date.now();
  const byOwner = gate("address", parsed.data.owner, OPENS_PER_OWNER_PER_HOUR, nowMs);
  if (!byOwner.ok) return refuse(429, byOwner.reason);
  const byIp = gate("device", rateLimitKey(request), OPENS_PER_IP_PER_HOUR, nowMs);
  if (!byIp.ok) return refuse(429, byIp.reason);
  const { status, result } = await openPrivate(auth.seat, parsed.data);
  return NextResponse.json(result, { status });
}
