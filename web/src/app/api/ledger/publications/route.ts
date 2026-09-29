import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { marketIdSchema } from "@agari/core/types";
import { classifyRejection, publishCall, readPublications, retractCall } from "@agari/markets/server";
import { z } from "zod";
import { BOARD_CACHE_TAG } from "@/features/leaderboard/board.server";
import { diagnosisReply, jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's opt-in publications (plan §5; leaderboards, takes, activity and sentiment read only these).
 *
 *   GET   this lease's publications, read AS the seat's party under this lease's handle (its seat address)
 *   POST  { marketId, source? } publishes the seat's live legs on that Window (`Leg_Publish`, actAs the seat only)
 *   DELETE { marketId } retracts this lease's publications on that Window (`Publication_Retract`)
 *
 * The party and the handle come from the lease row only (`no-party-from-request`); the body names a Window, nothing else.
 * `source: "receipt"` is for a settled call and is refused until the settlement leaves a receipt to publish from.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ marketId: marketIdSchema, source: z.enum(["leg", "receipt"]).default("leg") });

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const value = await readPublications(server.ledger.client, lease.party, lease.address);
    // `receipts` turns true once a settlement leaves a receipt with its own publish choice (a Daml follow-up).
    return replyWith({ value, address: lease.address, receipts: false });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = bodySchema.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {marketId, source?: 'leg' | 'receipt'}", 400);
  const { server, lease } = auth.seat;
  try {
    const result = await publishCall(
      { client: server.ledger.client, seats: server.ledger.seats },
      { party: lease.party, leaseId: lease.leaseId, handle: lease.address },
      { marketId: body.data.marketId, source: body.data.source },
    );
    if (result.kind === "published") revalidateTag(BOARD_CACHE_TAG, { expire: 0 });
    return replyWith(result, result.kind === "refused" ? 409 : 200);
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = z.object({ marketId: marketIdSchema }).safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {marketId}", 400);
  const { server, lease } = auth.seat;
  try {
    const out = await retractCall({ client: server.ledger.client }, { party: lease.party, leaseId: lease.leaseId, handle: lease.address }, { marketId: body.data.marketId });
    if (out.retracted > 0) revalidateTag(BOARD_CACHE_TAG, { expire: 0 });
    return replyWith(out);
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
