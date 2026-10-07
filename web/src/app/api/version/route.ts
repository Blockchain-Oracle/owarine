import { NextResponse } from "next/server";

/** The build this server runs; a page from an older build sees a different id and offers Refresh (Tradash's `aU`). */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? null }, { headers: { "cache-control": "no-store" } });
}
