import { isUpdateId } from "@agari/core/types";
import { sealsToWire } from "@agari/markets/desk";
import { classifyRejection } from "@agari/markets/server";
import { seatServer } from "@/lib/ledger.server";
import { diagnosisReply, refusal, replyWith } from "@/lib/seat.server";

/**
 * `GET /api/ledger/desk/seals/<updateId>`: the desk decisions one ledger update sealed (sequence, head, decision hash),
 * read as the venue, read-only. Public, like the reference's transaction on an explorer: it is what "Check it" compares
 * a shared record's hash against; the amounts stay on the desk's own page.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ updateId: string }> }) {
  const { updateId } = await context.params;
  if (!isUpdateId(updateId)) return refusal("unknown", "not a ledger update id", 400);
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  try {
    return replyWith(sealsToWire(await state.server.desk.seals(updateId)));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
