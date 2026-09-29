import type { NextRequest } from "next/server";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/** The seat's own consents (C8f), `?ids=1,2` to narrow; read AS the leased party only. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.some((id) => !/^\d{1,20}$/.test(id))) return refusal("unknown", "ids must be integers", 400);
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    return replyWith({ subscriptions: await server.agents.subscriptions({ party: lease.party, leaseId: lease.leaseId, address: lease.address }, ids.map(BigInt)) });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
