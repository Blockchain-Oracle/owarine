import type { NextRequest } from "next/server";
import { restingCancelRequestWire } from "@agari/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat cancels its own resting calls on one Window (C7c): `Rest_Cancel` on each, `actAs` = the lease's seat party
 * ONLY, the escrow of the lots still resting coming back as venue credit. The calls are named by their `callRef` and
 * found in the seat's own contracts, so another seat's call can never be named. One that already ended is `gone`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = restingCancelRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>, marketId, callRefs: [..]}", 400);
  const { server, lease } = auth.seat;
  const result = await server.ledger.writer.cancelRest({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, marketId: body.data.marketId, callRefs: body.data.callRefs });
  return replyWith(result);
}
