import type { NextRequest } from "next/server";
import { isUpdateId } from "@owarine/core/types";
import { classifyRejection, paidTo } from "@owarine/markets/server";
import { diagnosisReply, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * One of the seat's own transactions (C8f), read AS the leased party: `success` with the cash it paid the seat (a
 * revoke's returned budget), or `null` when the seat cannot see it. A rejected command leaves no transaction on Canton,
 * so there is no "reverted" answer here: a landed update succeeded. Only this lease's own updates (C4d L3): a seat party
 * is recycled, so an update from before the lease began is an earlier visitor's and reads as `null` too.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ updateId: string }> }) {
  const { updateId } = await context.params;
  if (!isUpdateId(updateId)) return refusal("unknown", "expected a Canton update id", 400);
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const tx = await server.client.updateById(updateId, {
      transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      eventFormat: { filtersByParty: { [lease.party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: {} } } }] } }, verbose: true },
    });
    const ours = tx && Number(tx.offset) >= lease.startOffset ? tx : null;
    return replyWith({ receipt: ours ? { status: "success", paidBase: paidTo(ours, lease.party) } : null });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
