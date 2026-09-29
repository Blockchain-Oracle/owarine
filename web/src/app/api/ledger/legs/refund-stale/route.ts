import type { NextRequest } from "next/server";
import { exitLegs } from "../exit";

/** The owner's own escape (`Leg_RefundStale`): backing plus fee back once `refundAfter` passes with no resolution. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return exitLegs(request, "refund");
}
