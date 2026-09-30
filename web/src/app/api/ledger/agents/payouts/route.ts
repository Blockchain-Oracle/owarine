import type { NextRequest } from "next/server";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The creator fees waiting for the seat (C8i): every `CreatorPayout` the venue made it, read AS the leased party only
 * (a payout's observer is its creator). A total, a fee count and one row per period; never a subscriber. Claimed with
 * `POST /api/ledger/agents/strategies/claim`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    return replyWith(await server.agents.payouts({ party: lease.party, leaseId: lease.leaseId, address: lease.address }));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
