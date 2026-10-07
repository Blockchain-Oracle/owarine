import type { NextRequest } from "next/server";
import { classifyRejection } from "@owarine/markets/server";
import { diagnosisReply, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own tickets (C8c), read live AS its leased party: range and moonshot rounds, parlay tickets, boosts and
 * Earn shares, each with what the Window's resolution says so far. The party comes from the lease row only, and only
 * this lease's contracts are read (from its start offset, C4d H3): a recycled seat never lists an earlier visitor's
 * settlement receipts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const read = await server.tickets.mine(lease.party, lease.startOffset);
    return replyWith({ value: read.value, address: lease.address, party: lease.party, offset: read.offset });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
