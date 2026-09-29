import { isAddress } from "@agari/core/types";
import { NextResponse, type NextRequest } from "next/server";
import { readMarketFacts } from "../../venue.server";

/** `GET /api/venue/markets/<appMarketId>` (C4): one Window's terms and state from the projection, `{market: null}` if unknown. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isAddress(id)) return refusal("unknown", "a Window id is base58", 400);
  try {
    const market = await readMarketFacts(id);
    if (market === undefined) return refusal("not-deployed", "no projection to read (DATABASE_URL)", 503);
    return NextResponse.json({ market }, { headers: { "cache-control": "public, s-maxage=1, stale-while-revalidate=4" } });
  } catch {
    return refusal("indexer-down", "the Window could not be read from the projection", 503);
  }
}

function refusal(kind: string, technical: string, status: number) {
  return NextResponse.json({ diagnosis: { kind, retryable: status >= 500, technical } }, { status, headers: { "cache-control": "no-store" } });
}
