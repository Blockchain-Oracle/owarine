import type { NextRequest } from "next/server";
import { exitQuoteRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * A firm exit (C7a, plan §6 mirrored for a sale): the sale as the seat confirmed it goes to ops over HMAC, which walks
 * the bid side of the venue ladder and either issues `BuyQuote`s for the seat's legs (~20 s), answers a requote below
 * the confirmed floor, or refuses. The web tier never acts as the venue; WHO sells comes from the lease row, never the body.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const parsed = exitQuoteRequestWire.safeParse(await jsonBody(request));
  if (!parsed.success) return refusal("invalid-price", `bad exit quote request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`, 400);
  if (parsed.data.contractsRaw <= 0n || parsed.data.displayedMinProceedsBase < 0n) return refusal("below-min-quantity", "the size must be positive", 400);
  const { server, lease } = auth.seat;
  const reply = await server.ops.exitQuote({ ...parsed.data, party: lease.party, leaseId: lease.leaseId });
  if (reply.kind === "quote") server.ledger.seats.invalidate(lease.party);
  return replyWith(reply);
}
