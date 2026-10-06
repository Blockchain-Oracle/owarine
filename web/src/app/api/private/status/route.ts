import { NextResponse } from "next/server";
import { privateStatus } from "@/features/private/canton.server";

/**
 * Whether the private route can run, and every reason it cannot (the control gates on `ready` and shows `reasons[0]`).
 * On Canton (C8d) the desk is the venue itself and the route is the seat's private bucket (`mode: venue-bucket`): it is
 * ready while the seat tier is configured and the venue is open (a reduce-only or paused venue takes no new calls).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await privateStatus());
}
