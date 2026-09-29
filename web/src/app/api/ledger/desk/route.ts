import type { NextRequest } from "next/server";
import { deskStateToWire } from "@agari/markets/desk";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, replyWith, seatFromRequest } from "@/lib/seat.server";
import { indexModeOf } from "@/features/desk/chain.server";

/**
 * `GET /api/ledger/desk`: the seat's own live desk (C8f, `DeskMandate`), read AS its leased party, in the reference's
 * `DeskState` shape (`{ state: null }` when it has none). The party comes from the lease row only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const state = await server.desk.state(lease.party, await indexModeOf(lease.address));
    return replyWith(deskStateToWire(state));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
