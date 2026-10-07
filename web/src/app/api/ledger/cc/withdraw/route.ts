import type { NextRequest } from "next/server";
import { ccWithdrawRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's ask to take deposited Canton Coin back (C7b): `{commandId, units}`, `actAs` the lease's seat party ONLY,
 * under the commandId the client journaled. The party is the lease's, never the body's. It creates the seat's request; the
 * venue's ops actor answers it (debit the cash, lower the allowance, instruct the token-standard transfer). While the
 * capability is `not-live` it refuses, before anything is journaled or signed.
 *
 * A phone proves each write with the one-request proof (`seatFromRequest(req, { write: true })`, K-211); the body is read
 * once, here, through `jsonBody`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const b = ccWithdrawRequestWire.safeParse(await jsonBody(request));
  if (!b.success) return refusal("unknown", "expected {commandId, units}", 400);
  return replyWith(
    await server.cc.requestWithdraw(
      { party: lease.party, leaseId: lease.leaseId, address: lease.address, fromOffset: lease.startOffset },
      { journalId: b.data.commandId, units: BigInt(b.data.units) },
    ),
  );
}
