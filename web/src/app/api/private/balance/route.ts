import { privateMoveRequestWire } from "@agari/core/private";
import type { NextRequest } from "next/server";
import { privateBalance } from "@/features/private/canton.server";
import { diagnosisReply, jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { classifyRejection } from "@agari/markets/server";

/**
 * The seat's private bucket (C8d, L-39).
 *
 *   GET   its balance and its private calls under this lease
 *   POST  { commandId, op: in | out, amountBase }: demo credits between the seat's balance and its private bucket, one
 *         transaction the seat and the venue sign together (ops); the lease says whose, the body only how much
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  try {
    return replyWith(await privateBalance(auth.seat));
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const parsed = privateMoveRequestWire.safeParse(await jsonBody(request));
  if (!parsed.success) return refusal("unknown", "expected {commandId, op: in|out, amountBase}", 400);
  const { server, lease } = auth.seat;
  const reply = await server.ops.privateMove({ party: lease.party, leaseId: lease.leaseId, requestId: parsed.data.commandId, op: parsed.data.op, amountBase: parsed.data.amountBase });
  server.ledger.seats.invalidate(lease.party);
  if (reply.kind === "refused") return diagnosisReply(reply.diagnosis as never, reply.diagnosis.kind === "rpc-down" ? 503 : 409);
  return replyWith(reply);
}
