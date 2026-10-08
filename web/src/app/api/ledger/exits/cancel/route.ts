import type { NextRequest } from "next/server";
import { exitCancelRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat disarms its exit on one Window side (R2): `RestExit_Cancel` on each exit it has there, `actAs` = the lease's
 * seat party ONLY. The exits are found in the seat's own contracts; none left (filled, swept) answers `gone`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = exitCancelRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId, marketId, side}", 400);
  const { server, lease } = auth.seat;
  const result = await server.ledger.seatPkgWriter.disarm({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, marketId: body.data.marketId, side: body.data.side });
  return replyWith(result);
}
