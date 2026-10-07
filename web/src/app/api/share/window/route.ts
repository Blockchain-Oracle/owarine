import { MARKET_PARAM } from "@owarine/core/urls";
import { isMarketId, toMarketId } from "@owarine/core/types";
import { NextResponse, type NextRequest } from "next/server";
import { verifiedWindowShare } from "@/lib/share-link.server";

/**
 * `GET /api/share/window?m=<marketId>&dir=&stake=&exp=&sig=` (C13a): whether a Window share link's signature holds, for
 * the app, which opens the same https link as a universal link but holds no server key. The answer is the share when
 * it verifies and its Window has not closed, else null; the app then opens the ticket with the side only. Public and
 * uncached: it reveals nothing the link does not already carry.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const id = q.get(MARKET_PARAM) ?? "";
  if (!isMarketId(id)) return NextResponse.json({ error: "m must be a Window id" }, { status: 400 });
  const share = verifiedWindowShare(toMarketId(id), Object.fromEntries(q), Math.floor(Date.now() / 1000));
  const body = share ? { share: { marketId: share.marketId, side: share.side, stakeBase: share.stakeBase.toString(), expiresSec: share.expiresSec } } : { share: null };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
