import type { NextRequest } from "next/server";
import { DESK_OWNER_ACTIONS, deskWriteRequestWire, type DeskOwnerAction } from "@owarine/markets/desk";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The owner's own desk writes (C8f, `DeskMandate`), each with `actAs` = the lease's seat party ONLY, under the
 * commandId the client sent (`{commandId: <uuid>, …}`), journaled and recovered by it:
 *
 *   open · allow · disallow · deposit · withdraw · limits · mode · operator · revoke · pause · unpause · close
 *
 * The operator's actions (trade, sell, checkpoint, its own pause) are the desk runner's, never a route's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAction = (a: string): a is DeskOwnerAction => (DESK_OWNER_ACTIONS as readonly string[]).includes(a);

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!isAction(action)) return refusal("unknown", `no desk action ${action}`, 404);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const parsed = deskWriteRequestWire[action].safeParse(await jsonBody(request));
  if (!parsed.success) return refusal("unknown", `bad ${action} request: ${parsed.error.issues[0]?.path.join(".") ?? "?"}`, 400);
  const result = await server.desk.write({ party: lease.party, leaseId: lease.leaseId }, action, parsed.data as Record<string, unknown> & { commandId: string });
  server.ledger.seats.invalidate(lease.party);
  return replyWith(result);
}
