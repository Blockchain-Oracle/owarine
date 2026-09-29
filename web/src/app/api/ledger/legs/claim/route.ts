import type { NextRequest } from "next/server";
import { exitLegs } from "../exit";

/**
 * One tap claims every leg the seat holds on a resolved Window (`Leg_Claim`, the resolution passed as a disclosed
 * contract), falling back to the stale refund past `refundAfter` with no resolution. Works with ops down.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return exitLegs(request, "claim");
}
