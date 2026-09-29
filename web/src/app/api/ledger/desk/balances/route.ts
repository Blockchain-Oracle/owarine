import type { NextRequest } from "next/server";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { ownerBalancesToWire } from "@agari/markets/desk";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * `GET /api/ledger/desk/balances?symbols=OPENAI,SPACEX`: what the seat could move into its desk (its own cash; a
 * company comes into the desk only by the desk buying it, so every name reads 0), read AS the leased party.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const asked = (request.nextUrl.searchParams.get("symbols") ?? "").split(",").filter((s): s is PreIpoSymbol => (PRE_IPO_SYMBOLS as readonly string[]).includes(s));
  try {
    return replyWith(ownerBalancesToWire(await server.desk.balances(lease.party, asked)));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
