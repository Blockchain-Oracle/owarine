import type { NextRequest } from "next/server";
import { exitAcceptRequestWire } from "@owarine/markets";
import { jsonBody, recordBusy, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat sells back (C7a): `BuyQuote_Accept` on the exit quote's buy-backs, in one command, with `actAs` = the lease's
 * seat party ONLY, under the commandId the client journaled before sending. The sale is booked from the transaction's
 * created contracts. A rejection maps to one of the existing Diagnosis kinds (`classifyRejection`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CID_RE = /^[0-9a-f]{40,400}$/;

export async function POST(request: NextRequest, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params;
  if (!CID_RE.test(cid)) return refusal("contract-revert", "not a contract id", 400);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = exitAcceptRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>, with?: [<buy-back cid>]}", 400);
  const buyQuoteCids = [...new Set([cid, ...body.data.with])];
  const { server, lease } = auth.seat;
  const result = await server.ledger.writer.sell({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, buyQuoteCids });
  if (result.kind === "confirmed") {
    // A sale can empty the seat: its idle clock restarts from what it still holds.
    const after = await server.ledger.balance(lease.party).catch(() => null);
    if (after) await recordBusy(auth.seat, after);
  }
  return replyWith(result);
}
