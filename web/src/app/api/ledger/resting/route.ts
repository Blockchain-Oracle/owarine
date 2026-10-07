import type { NextRequest } from "next/server";
import { restingRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { regionHold } from "@/lib/region.server";

/**
 * The venue's offer to hold a pre-open resting call (C7c, K-235): the request as the seat confirmed it goes to ops over
 * HMAC, which checks the Window is still listed, re-sizes the call on the Window's own grid, counts the seat's calls
 * and, if all is well, makes a short-lived `RestingOffer` for the seat's party (never later than the bell). The seat then
 * places it with its own cash (`resting/<cid>/place`). WHO the call is for comes from the lease row, never the body.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const held = regionHold(request);
  if (held) return held;
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const parsed = restingRequestWire.safeParse(await jsonBody(request));
  if (!parsed.success) return refusal("invalid-price", `bad resting call: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`, 400);
  if (parsed.data.stakeBase <= 0n || parsed.data.displayedEscrowBase <= 0n) return refusal("below-min-quantity", "stake and escrow must be positive", 400);
  const { server, lease } = auth.seat;
  const reply = await server.ops.restingOffer({ ...parsed.data, party: lease.party, leaseId: lease.leaseId });
  if (reply.kind === "offer") server.ledger.seats.invalidate(lease.party);
  return replyWith(reply);
}
