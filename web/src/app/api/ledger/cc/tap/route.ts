import type { NextRequest } from "next/server";
import { ccTapRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { regionHold } from "@/lib/region.server";

/**
 * The seat's DevNet coin tap (revamp 2b): `{commandId}`, `actAs` the lease's seat party ONLY. The seat mints the faucet's
 * fixed amount of DevNet Canton Coin for itself through `AmuletRules_DevNet_Tap`, so it has coin to deposit. Refused
 * where no faucet is configured (every network but DevNet), while the path is not live, and for a seat that already holds
 * the faucet's amount. The party is the lease's, never the body's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const held = regionHold(request);
  if (held) return held;
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const b = ccTapRequestWire.safeParse(await jsonBody(request));
  if (!b.success) return refusal("unknown", "expected {commandId}", 400);
  return replyWith(await server.cc.requestTap({ party: lease.party, leaseId: lease.leaseId, address: lease.address, fromOffset: lease.startOffset }, { journalId: b.data.commandId }));
}
