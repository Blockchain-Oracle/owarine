import type { NextRequest } from "next/server";
import { parseShareInstruments, HoldingsReadError, readHoldings } from "@agari/markets/holdings";
import { webEnv } from "@/lib/env";
import { seatFromRequest } from "@/lib/seat.server";
import { admitIp, cachedHoldings, clientIp, OWNER_CACHE_MS } from "./gate";

/**
 * `GET /api/holdings` (C7b): the leased seat's verified tokenised share holdings on Canton, read-only, with integers as
 * strings. The party is the lease's (`seatFromRequest`), never a query parameter: the reference took a wallet address, and a
 * Canton party read for anyone who names it would be a privacy hole. The read is a CIP-56 `Holding` interface query as the
 * seat (`@agari/markets/holdings`); an instrument counts as a share only if the deployment maps it (`CIP56_SHARE_INSTRUMENTS`).
 * A failed read is a 502, never an empty list.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const nowMs = Date.now();
  if (!admitIp(clientIp(request), nowMs)) return refuse(429, "Too many holdings reads — try again in a minute.");
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const body = await cachedHoldings(lease.party, nowMs, () =>
      readHoldings({ client: server.client, party: lease.party, instruments: parseShareInstruments(process.env.CIP56_SHARE_INSTRUMENTS), cluster: webEnv.markets.cluster, nowSec: Math.floor(nowMs / 1000) }),
    );
    return Response.json(body, { headers: { "Cache-Control": `private, max-age=${OWNER_CACHE_MS / 1000}` } });
  } catch (error) {
    // HoldingsReadError messages carry no URL or credential by construction; anything else is summarized, never echoed.
    console.error("api/holdings:", error instanceof HoldingsReadError ? error.message : error instanceof Error ? error.name : "unknown");
    return refuse(502, "Could not read holdings just now.");
  }
}
