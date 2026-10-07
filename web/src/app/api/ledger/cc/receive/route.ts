import type { NextRequest } from "next/server";
import { ccReceiveRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { regionHold } from "@/lib/region.server";

/**
 * The withdrawal's second step (revamp 2b): `{commandId}`, `actAs` the lease's seat party ONLY. The seat accepts the
 * token-standard transfers the venue sent it for its own `sent` withdrawals (a seat has no preapproval, so each is an
 * offer), with the registry's accept context; the venue's rail then records each receipt completed. The party is the
 * lease's, never the body's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const held = regionHold(request);
  if (held) return held;
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const b = ccReceiveRequestWire.safeParse(await jsonBody(request));
  if (!b.success) return refusal("unknown", "expected {commandId}", 400);
  return replyWith(await server.cc.requestReceive({ party: lease.party, leaseId: lease.leaseId, address: lease.address, fromOffset: lease.startOffset }, { journalId: b.data.commandId }));
}
