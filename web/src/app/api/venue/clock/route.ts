import { NextResponse } from "next/server";
import { readVenueClock } from "../venue.server";

/**
 * `GET /api/venue/clock` (C4): the server's wall clock with the ledger end read beside it, and the newest record time
 * the projection holds. The client's `syncClock` turns it into an offset; `slot` carries the ledger offset. Never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readVenueClock(), { headers: { "cache-control": "no-store" } });
}
