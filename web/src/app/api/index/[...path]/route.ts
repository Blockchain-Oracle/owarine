import { getDb, indexReader, type IndexReader } from "@agari/db";
import { ensureMarkets } from "@agari/markets";
import { NextResponse, type NextRequest } from "next/server";
import { seatCaller } from "@/lib/auth/seat-caller.server";
import { webEnv } from "@/lib/env";
import { seatServer } from "@/lib/ledger.server";
import { BadRequest, resolveIndexQuery, type SeatLeaseScope } from "./queries";

/** The seat's current lease for a lease-scoped read; null when the seat tier is off or the address holds no lease. */
async function leaseOf(address: string): Promise<SeatLeaseScope | null> {
  const tier = seatServer();
  if (!tier.ok) return null;
  const lease = await tier.server.store.byAddress(address).catch(() => null);
  return lease ? { party: lease.party, fromOffset: lease.startOffset } : null;
}

/**
 * The address a seat's own rows are recorded under: the key that took the lease. A key joined to that seat by a seat
 * link (iOS step 2b) reads the same rows as the holder, so "the same seat on web and phone" shows the same calls.
 */
async function holderOf(address: string): Promise<string | null> {
  const tier = seatServer();
  if (!tier.ok) return null;
  return (await tier.server.store.byAddress(address).catch(() => null))?.address ?? null;
}

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
    const holder = await holderOf(caller);
    if (holder && holder !== caller) resolved = resolveIndexQuery(["wallet", holder, ...path.slice(2)], query, webEnv.markets.packageName) ?? resolved;
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "indexer not configured" }, { status: 503, headers: { "cache-control": PRIVATE_CACHE } });
  reader ??= indexReader(db);

  try {
    const lease = resolved.scope === "wallet" && resolved.seatLease && resolved.owner ? await leaseOf(resolved.owner) : null;
    const rows = await resolved.run(reader, db, lease);
    const cache = resolved.scope === "wallet" ? PRIVATE_CACHE : (resolved.cacheControl ?? PUBLIC_CACHE);
    return NextResponse.json({ rows }, { headers: { "cache-control": cache } });
  } catch {
    // The connection or the query failed: an outage, which the provider reads as `indexer-down` and retries.
    return NextResponse.json({ error: "indexer query failed" }, { status: 503, headers: { "cache-control": PRIVATE_CACHE } });
  }
}
