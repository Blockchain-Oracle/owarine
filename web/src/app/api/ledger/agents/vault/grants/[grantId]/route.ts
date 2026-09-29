import type { NextRequest } from "next/server";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * One of the seat's grants by id (C8f): the live grant, or `null` when it is no longer on the ledger (a grant leaves
 * the ledger only by its owner's revoke; a trade or a top-up keeps its id). Read AS the leased party only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await context.params;
  if (!/^\d{1,20}$/.test(grantId)) return refusal("unknown", "grant id must be an integer", 400);
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    return replyWith({ grant: await server.agents.grant({ party: lease.party, leaseId: lease.leaseId, address: lease.address }, BigInt(grantId)) });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
