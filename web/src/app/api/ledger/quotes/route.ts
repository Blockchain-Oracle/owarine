import type { NextRequest } from "next/server";
import { quoteRequestWire } from "@agari/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { regionHold } from "@/lib/region.server";

/**
 * A firm quote at click time (plan §6): the request as the seat confirmed it goes to ops over HMAC, which prices the
 * venue ladder and either issues a `Quote` to the seat's party (~20 s), answers a requote above the confirmed cap, or
 * refuses. The web tier never acts as the venue; WHO the quote is for comes from the lease row, never the body.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const held = regionHold(request);
  if (held) return held;
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const parsed = quoteRequestWire.safeParse(await jsonBody(request));
  if (!parsed.success) return refusal("invalid-price", `bad quote request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`, 400);
  if (parsed.data.stakeBase <= 0n || parsed.data.displayedMaxCostBase <= 0n) return refusal("below-min-quantity", "stake and cap must be positive", 400);
  const { server, lease } = auth.seat;
  const reply = await server.ops.quote({ ...parsed.data, party: lease.party, leaseId: lease.leaseId });
  if (reply.kind === "quote") server.ledger.seats.invalidate(lease.party);
  return replyWith(reply);
}
