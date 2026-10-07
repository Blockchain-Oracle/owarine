import type { NextRequest } from "next/server";
import { legsRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/** Shared by `claim` and `refund-stale`: the Window is named, the legs are the lease's party's own. */
export async function exitLegs(request: NextRequest, mode: "claim" | "refund") {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = legsRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>, marketId}", 400);
  const { server, lease } = auth.seat;
  const result = await server.ledger.writer.exitLegs({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, marketId: body.data.marketId, mode });
  return replyWith(result);
}
