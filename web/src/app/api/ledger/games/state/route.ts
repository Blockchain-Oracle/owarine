import { diagnosisReply, refusal, replyWith } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";

/**
 * The duel arena as ops reads it from the ledger (C9b): its tiers (side pot and per-card cap), its phase windows, what
 * it escrows now, and whether it takes matches. Public: `ArenaTerms` is the venue's own table, and no seat's contract
 * is in it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  const r = await state.server.ops.gameState();
  return r.ok ? replyWith(r.value) : diagnosisReply(r.diagnosis, 503);
}
