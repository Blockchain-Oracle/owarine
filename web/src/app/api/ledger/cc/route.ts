import type { NextRequest } from "next/server";
import { classifyRejection } from "@agari/markets/server";
import { diagnosisReply, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's Canton Coin path (C7b): what it deposited and may take back (its allowance), its cash, its receipts and
 * pending asks, the token-standard coin it holds, the listing's stated rate and the venue's latest reserve statement.
 * Read AS the leased party only. While the capability is `not-live` (`@agari/core/cc`) it says so, with the reason.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    return replyWith(await server.cc.status({ party: lease.party, leaseId: lease.leaseId, address: lease.address, fromOffset: lease.startOffset }));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
