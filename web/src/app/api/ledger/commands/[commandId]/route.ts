import type { NextRequest } from "next/server";
import { isJournalId, seatCommandId, type SeatIntent } from "@agari/markets/server";
import { replyWith, refusal, seatFromRequest } from "@/lib/seat.server";

/**
 * A journaled command's outcome, for the lease that sent it only (plan §8): polled when an accept or claim got no
 * answer. `landed` / `failed` come from the server journal or the ledger's completions; `absent` once its deadline
 * has passed with none. Another lease's command id answers 404, as if it did not exist.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A duel pick journals its accept and its record under one id: the record ("duel") is asked first, it is the later step.
const INTENTS: SeatIntent[] = ["duel", "accept", "claim", "refund", "sell", "agent", "rest", "rest-cancel"];

export async function GET(request: NextRequest, context: { params: Promise<{ commandId: string }> }) {
  const { commandId } = await context.params;
  if (!isJournalId(commandId)) return refusal("unknown", "expected a journal uuid", 400);
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const actor = { party: auth.seat.lease.party, leaseId: auth.seat.lease.leaseId };
  for (const intent of INTENTS) {
    const status = await auth.seat.server.ledger.writer.status(actor, seatCommandId(intent, commandId));
    if (status) return replyWith({ commandId, ...status });
  }
  return refusal("unknown", "no such command for this seat", 404);
}
