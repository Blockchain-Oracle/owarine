import { diagnosisReply, refusal, replyWith } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";

/**
 * The three ticket reserves (range, parlay, boost) as ops reads them from the ledger (C8c): each live statement's
 * assets and shares, what is liquid, what live tickets lock, and whether the reserve is open. Public: a reserve's
 * statement is venue-signed and auditor-visible, and no seat's own contract is in it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  const r = await state.server.ops.ticketState();
  return r.ok ? replyWith(r.value) : diagnosisReply(r.diagnosis, 503);
}
