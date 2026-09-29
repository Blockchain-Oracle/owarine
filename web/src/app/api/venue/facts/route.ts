import { NextResponse } from "next/server";
import { readVenueFacts } from "../venue.server";

/**
 * `GET /api/venue/facts` (C4): the venue and every Series, read from the projection, for the read runtime's
 * `readVenue` / `readSeries`. Public: the same for every visitor, so it rides a short shared cache.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const facts = await readVenueFacts();
    if (!facts) return refusal("not-deployed", "the venue's projection holds nothing yet (no database, or no venue projected)", 503);
    return NextResponse.json(facts, { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
  } catch {
    return refusal("indexer-down", "the venue facts could not be read from the projection", 503);
  }
}

function refusal(kind: string, technical: string, status: number) {
  return NextResponse.json({ diagnosis: { kind, retryable: status >= 500, technical } }, { status, headers: { "cache-control": "no-store" } });
}
