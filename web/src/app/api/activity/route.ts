import { addressSchema } from "@owarine/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inboxFeed, ownInboxFeed } from "@/features/activity/feed.server";
import { seatCaller } from "@/lib/auth/seat-caller.server";
import { webEnv } from "@/lib/env";
import { seatServer } from "@/lib/ledger.server";

/**
 * `GET /api/activity?wallet&sinceSec`: one wallet's inbox from the index (spec §1.6), polled every 15 s and never
 * cached. `LifecycleWatcher` reads it with `sinceSec` to learn what changed since its last poll.
 *
 * On Canton (C13a) a seat's rows are private: when the caller proves it is that seat (the web's cookie or the phone's
 * signed read header), the inbox is its own fills and verdicts from the projection under its current lease, published
 * or not; for anyone else it is only what the seat published. A seat with no lease reads the published view.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
/** The seat's current lease, as `/api/index` resolves it; null when the seat tier is off or the address holds none. */
async function leaseOf(address: string): Promise<{ party: string; fromOffset: number } | null> {
  const tier = seatServer();
  if (!tier.ok) return null;
  const lease = await tier.server.store.byAddress(address).catch(() => null);
  return lease ? { party: lease.party, fromOffset: lease.startOffset } : null;
}

const querySchema = z.object({ wallet: addressSchema, sinceSec: z.coerce.number().int().nonnegative().optional() });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({ wallet: params.get("wallet"), sinceSec: params.get("sinceSec") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "wallet must be a base58 address; sinceSec a unix second" }, { status: 400, headers: NO_STORE });
  try {
    const lease = (await seatCaller(req.headers, webEnv.markets.cluster)) === parsed.data.wallet ? await leaseOf(parsed.data.wallet) : null;
    const feed = lease ? await ownInboxFeed(parsed.data.wallet, lease, parsed.data.sinceSec) : await inboxFeed(parsed.data.wallet, parsed.data.sinceSec);
    return NextResponse.json(feed, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "activity query failed" }, { status: 503, headers: NO_STORE });
  }
}
