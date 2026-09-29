import { getDb, indexReader, type IndexReader } from "@agari/db";
import { ensureMarkets } from "@agari/markets";
import { NextResponse, type NextRequest } from "next/server";
import { seatCaller } from "@/lib/auth/seat-caller.server";
import { webEnv } from "@/lib/env";
import { BadRequest, resolveIndexQuery } from "./queries";

/**
 * The projection's read API (first-call.md §5): lists, Window rows with prints, a seat's fills, positions and actions,
 * print history, candles and freshness, straight from Postgres. Never gates a write. Public answers ride a 2 s shared
 * cache; a seat's own rows need its signed read header (`x-agari-seat-read`) and are never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_CACHE = "public, s-maxage=2, stale-while-revalidate=8";
const PRIVATE_CACHE = "private, no-store";

let reader: IndexReader | null = null;

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  ensureMarkets(webEnv.markets);
  const { path } = await context.params;
  const query = Object.fromEntries(request.nextUrl.searchParams);
  let resolved;
  try {
    // The projection keys its freshness row by the Daml package it follows (the reference keyed it by program id).
    resolved = resolveIndexQuery(path, query, webEnv.markets.packageName);
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  if (!resolved) return NextResponse.json({ error: `no index path /${path.join("/")}` }, { status: 404 });

  // A seat's rows are private on Canton (plan §5): only that seat, proven by a fresh signed read header, may read them.
  if (resolved.scope === "wallet") {
    const caller = await seatCaller(request.headers, webEnv.markets.cluster);
    if (caller === null || caller !== resolved.owner) {
      return NextResponse.json({ error: "a seat reads only its own rows" }, { status: 403, headers: { "cache-control": PRIVATE_CACHE } });
    }
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "indexer not configured" }, { status: 503, headers: { "cache-control": PRIVATE_CACHE } });
  reader ??= indexReader(db);

  try {
    const rows = await resolved.run(reader, db);
    const cache = resolved.scope === "wallet" ? PRIVATE_CACHE : (resolved.cacheControl ?? PUBLIC_CACHE);
    return NextResponse.json({ rows }, { headers: { "cache-control": cache } });
  } catch {
    // The connection or the query failed: an outage, which the provider reads as `indexer-down` and retries.
    return NextResponse.json({ error: "indexer query failed" }, { status: 503, headers: { "cache-control": PRIVATE_CACHE } });
  }
}
