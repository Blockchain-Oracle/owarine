import type { NextRequest } from "next/server";
import { DUEL_ACTIONS, duelWriteRequestWire, type DuelAction } from "@owarine/markets/server";
import { jsonBody, recordBusy, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own choices on a duel (C9b), each with `actAs` = the lease's seat party ONLY, under the commandId the
 * client journaled before sending (`{commandId, matchId, cardIndex?, side?}`):
 *
 *   open                 the creator puts the sealed deck's commitment and its side pot on the ledger
 *   join                 the named challenger matches the pot
 *   pick                 one card, one side: a firm quote within the tier's per-card cap, accepted with the duel's tag,
 *                        then recorded on the match (`Duel_RecordPick`)
 *   cancel               the creator withdraws an unjoined duel
 *   lock · settle · finalize · refund-unjoined · refund-unrevealed · refund-stale
 *                        the cranks any named player may run; `settle` scores the seat's own pick on `cardIndex`
 *
 * The pairing is the room's (by seat address); who acts is the lease. A rejection maps to an existing Diagnosis kind.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAction = (a: string): a is DuelAction => (DUEL_ACTIONS as readonly string[]).includes(a);

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!isAction(action)) return refusal("unknown", `no duel action ${action}`, 404);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const body = duelWriteRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>, matchId: 0x…, cardIndex?, side?}", 400);
  const result = await server.games.write({ party: lease.party, leaseId: lease.leaseId }, action, body.data, lease.address);
  server.ledger.seats.invalidate(lease.party);
  // A duel with the seat's pot or legs in it keeps the seat busy until its cards can settle, like an open leg.
  if (result.kind === "confirmed" && (action === "open" || action === "join" || action === "pick")) {
    const busyUntilMs = Date.now() + 2 * 3_600_000;
    if (busyUntilMs > lease.busyUntilMs) await recordBusy(auth.seat, { busyUntilMs, openLegs: lease.openLegs });
  }
  return replyWith(result);
}
