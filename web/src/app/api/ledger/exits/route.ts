import type { NextRequest } from "next/server";
import { armExitRequestWire } from "@owarine/markets";
import { classifyRejection } from "@owarine/markets/server";
import { diagnosisReply, jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's resting exits (R2, abu-pm-seat): a trailing stop, a stop or a take-profit the venue fills later at its own
 * bid, never below the floor the seat signs. `GET` answers the seat's exits and open transfers, read AS its leased
 * party (`deployed: false` until the R2 DAR is on the participant). `POST` arms an exit over everything the seat holds
 * on one Window side, `actAs` = the lease's seat party ONLY, replacing its earlier exit there in the same command.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const snap = await server.ledger.seatPkg.read(lease.party);
    return replyWith({ ...snap, party: lease.party });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = armExitRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId, marketId, side, floorTicks, takeProfitTicks?, stop?: {stopE8, trailBps}}", 400);
  const { server, lease } = auth.seat;
  const { commandId, ...exit } = body.data;
  const result = await server.ledger.seatPkgWriter.arm({ party: lease.party, leaseId: lease.leaseId }, { journalId: commandId, ...exit });
  return replyWith(result);
}
