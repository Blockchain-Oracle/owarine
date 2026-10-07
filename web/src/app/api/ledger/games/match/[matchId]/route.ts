import { isHash32 } from "@owarine/core/types";
import { diagnosisReply, refusal, replyWith } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";

/**
 * One duel by its room id (C9b), whichever contract holds it now: the open offer, the live match (its revealed deck,
 * both seats' recorded picks, the running PnL) or its result. Public, as the reference's match link is: a pick is
 * public to the match, and the players are named by their seat addresses, never their parties.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params;
  const id = matchId.toLowerCase();
  if (!isHash32(id)) return refusal("unknown", "expected a 0x… match id", 400);
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  const r = await state.server.ops.gameMatch(id);
  return r.ok ? replyWith(r.value) : diagnosisReply(r.diagnosis, 503);
}
