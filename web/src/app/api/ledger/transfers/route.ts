import type { NextRequest } from "next/server";
import { sendRequestWire } from "@owarine/markets";
import { classifyRejection } from "@owarine/markets/server";
import { diagnosisReply, jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * Credits between seats (R2, abu-pm-seat). `GET`: the seat's open transfers, sent and received, read AS its leased
 * party. `POST`: send `amount` of the seat's spendable credits to the seat `to` as an offer that seat accepts or
 * rejects; `actAs` = the lease's seat party ONLY, with the venue's transfer desk disclosed. `to` is the receiver, never
 * a party this route acts or reads as.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const snap = await server.ledger.seatPkg.read(lease.party);
    return replyWith({ ...snap, party: lease.party });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = sendRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId, to: <seat id>, amount, memo?}", 400);
  const { server, lease } = auth.seat;
  const result = await server.ledger.seatPkgWriter.send({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, receiver: body.data.to, amount: body.data.amount, memo: body.data.memo });
  return replyWith(result);
}
