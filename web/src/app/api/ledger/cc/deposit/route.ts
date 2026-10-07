import type { NextRequest } from "next/server";
import { ccDepositRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { regionHold } from "@/lib/region.server";

/**
 * The seat's Canton Coin deposit (C7b): `{commandId, amount}`, `actAs` the lease's seat party ONLY. It instructs the
 * token-standard transfer of `amount` (a Decimal string, exact or refused as dust) from the seat to the venue with the
 * registry's factory and choice context; the venue's ops actor then accepts it and credits the seat's cash in one
 * transaction. The party is the lease's, never the body's. While the capability is `not-live` it refuses, before the
 * registry is asked or anything is journaled or signed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const held = regionHold(request);
  if (held) return held;
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const b = ccDepositRequestWire.safeParse(await jsonBody(request));
  if (!b.success) return refusal("unknown", "expected {commandId, amount}", 400);
  return replyWith(
    await server.cc.requestDeposit(
      { party: lease.party, leaseId: lease.leaseId, address: lease.address, fromOffset: lease.startOffset },
      { journalId: b.data.commandId, amount: b.data.amount },
    ),
  );
}
