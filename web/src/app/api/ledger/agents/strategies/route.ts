import type { NextRequest } from "next/server";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";
import { leasedAddresses } from "@/lib/agents.server";

/**
 * The strategy registry as the venue lists it (C8f): every listing, the creator's sealed text, its envelope, fee and
 * revision, and how many consents it has (a count; who subscribes stays between the venue and each subscriber).
 * Public, read-only. A creator who holds a lease is shown by its seat address; when the caller proves a seat, its own
 * party is shown by the key that proved it (C4c: a device joined by a seat link finds its own listings).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  try {
    const auth = await seatFromRequest(request, { write: false });
    // The caller's own label counts from its lease's start (C8i): a recycled seat is never the creator of the previous
    // visitor's strategy, whatever key it proves.
    const caller = auth.ok ? { party: auth.seat.lease.party, address: auth.seat.caller, fromOffset: auth.seat.lease.startOffset } : null;
    return replyWith({ strategies: await state.server.agents.strategies(await leasedAddresses(caller)) });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
