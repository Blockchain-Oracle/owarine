import { NextResponse } from "next/server";
import { readAudit } from "@/features/stats/audit.server";

/**
 * `GET /api/stats/audit` (C5): the `/stats` auditor view. Market totals from the venue's projection behind the k = 5
 * floor, the reserve reporter's snapshot, and the newest independent recount. Venue-level only; a short public cache.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readAudit(), { headers: { "cache-control": "public, s-maxage=15" } });
}
