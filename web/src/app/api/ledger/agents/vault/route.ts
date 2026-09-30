import type { NextRequest } from "next/server";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's Trading Balance on Canton (C8f): its cash (the seat's `VenueCash` IS the trading balance) and its live
 * `AgentGrant`s, one per kind (X executor, strategy runner; a session key does not exist here). Read AS the leased
 * party only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    return replyWith(await server.agents.vault({ party: lease.party, leaseId: lease.leaseId, address: lease.address, fromOffset: lease.startOffset }));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
