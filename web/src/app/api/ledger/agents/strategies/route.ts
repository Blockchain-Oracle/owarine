import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, refusal, replyWith } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";
import { leasedAddresses } from "@/lib/agents.server";

/**
 * The strategy registry as the venue lists it (C8f): every listing, the creator's sealed text, its envelope, fee and
 * revision, and how many consents it has (a count; who subscribes stays between the venue and each subscriber).
 * Public, read-only. A creator who holds a lease is shown by its seat address.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  try {
    return replyWith({ strategies: await state.server.agents.strategies(await leasedAddresses()) });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
