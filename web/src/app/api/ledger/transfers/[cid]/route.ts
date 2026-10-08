import type { NextRequest } from "next/server";
import { transferEndRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * Ends one open transfer (R2): the receiver accepts or rejects it, the sender withdraws it; `actAs` = the lease's seat
 * party ONLY. The offer is found among the seat's own transfers, so a seat can only end one it sent or received, and
 * only in its own role.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CID_RE = /^[0-9a-f]{40,400}$/;

export async function POST(request: NextRequest, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params;
  if (!CID_RE.test(cid)) return refusal("contract-revert", "not a contract id", 400);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = transferEndRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId, choice: accept | reject | withdraw}", 400);
  const { server, lease } = auth.seat;
  const result = await server.ledger.seatPkgWriter.endTransfer({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, offerCid: cid, choice: body.data.choice });
  return replyWith(result);
}
