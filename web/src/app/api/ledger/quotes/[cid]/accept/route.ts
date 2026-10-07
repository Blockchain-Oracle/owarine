import type { NextRequest } from "next/server";
import { writeRequestWire } from "@owarine/markets";
import { jsonBody, recordBusy, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";
import { regionHold } from "@/lib/region.server";

/**
 * The seat accepts its quote (plan §8): `Quote_Accept` with `actAs` = the lease's seat party ONLY, under the commandId
 * the client journaled before sending. The booked order is built from the created `Leg`. A rejection maps to one of
 * the existing Diagnosis kinds (`classifyRejection`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CID_RE = /^[0-9a-f]{40,400}$/;

export async function POST(request: NextRequest, context: { params: Promise<{ cid: string }> }) {
  const held = regionHold(request);
  if (held) return held;
  const { cid } = await context.params;
  if (!CID_RE.test(cid)) return refusal("contract-revert", "not a contract id", 400);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = writeRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>}", 400);
  const { server, lease } = auth.seat;
  const result = await server.ledger.writer.accept({ party: lease.party, leaseId: lease.leaseId }, { journalId: body.data.commandId, quoteCid: cid });
  if (result.kind === "confirmed") {
    // The new leg pauses the seat's idle clock until its refund deadline: a seat with an open leg is never drained.
    const after = await server.ledger.balance(lease.party).catch(() => null);
    if (after) await recordBusy(auth.seat, after);
  }
  return replyWith(result);
}
