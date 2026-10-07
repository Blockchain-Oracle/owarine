import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { marketIdSchema } from "@owarine/core/types";
import { classifyRejection, publishCall, readPublications, retractCall } from "@owarine/markets/server";
import { getDb, privatePositions } from "@owarine/db";
import { z } from "zod";
import { BOARD_CACHE_TAG } from "@/features/leaderboard/board.server";
import { diagnosisReply, jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's opt-in publications (plan §5; leaderboards, takes, activity and sentiment read only these).
 *
 *   GET   this lease's publications, read AS the seat's party under this lease's handle (its seat address)
 *   POST  { marketId, source?, receiptId? } publishes the seat's live legs on that Window (`Leg_Publish`), or with
 *         `source: "receipt"` its settled calls there from this lease's `SettlementReceipt`s (`Receipt_Publish`, engine
 *         0.4.0); a ticket names its receipt. actAs the seat only
 *   DELETE { marketId, product? } retracts this lease's publications of one product on that Window (`Publication_Retract`):
 *         the pair legs by default (`product` null), or that ticket product's (C6e, K-070), never both
 *
 * The party and the handle come from the lease row only (`no-party-from-request`); the body names a Window, nothing else.
 * `source: "receipt"` only publishes receipts created under this lease (from its start offset).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  marketId: marketIdSchema,
  source: z.enum(["leg", "receipt"]).default("leg"),
  receiptId: z.string().regex(/^[0-9a-f]{2,400}$/, "expected a ledger contract id").optional(),
});

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  try {
    const value = await readPublications(server.ledger.client, lease.party, lease.address);
    // Engine 0.4.0: a settlement leaves a receipt with its own publish choice, so settled calls publish too.
    return replyWith({ value, address: lease.address, receipts: true });
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = bodySchema.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {marketId, source?: 'leg' | 'receipt', receiptId?}", 400);
  const { server, lease } = auth.seat;
  try {
    // C8d (L-39): the seat's private calls stay off every public read, their receipts included.
    const db = getDb();
    const privatePairs = new Set(body.data.source === "receipt" && db ? (await privatePositions(db, lease.party, lease.startOffset, 200)).map((p) => p.pair_id) : []);
    const result = await publishCall(
      { client: server.ledger.client, seats: server.ledger.seats },
      { party: lease.party, leaseId: lease.leaseId, handle: lease.address, fromOffset: lease.startOffset },
      { marketId: body.data.marketId, source: body.data.source, privatePairs, ...(body.data.receiptId ? { receiptId: body.data.receiptId } : {}) },
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
  const body = z.object({ marketId: marketIdSchema, product: z.string().regex(/^[a-z]{2,20}$/).nullable().default(null) }).safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {marketId, product?: ticket product | null}", 400);
  const { server, lease } = auth.seat;
  try {
    const out = await retractCall({ client: server.ledger.client }, { party: lease.party, leaseId: lease.leaseId, handle: lease.address }, { marketId: body.data.marketId, product: body.data.product });
    if (out.retracted > 0) revalidateTag(BOARD_CACHE_TAG, { expire: 0 });
    return replyWith(out);
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
}
