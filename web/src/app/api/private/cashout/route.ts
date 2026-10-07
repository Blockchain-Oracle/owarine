import { privateCantonCashoutRequestWire } from "@owarine/core/private";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cashoutPrivate } from "@/features/private/canton.server";
import { jsonBody, seatFromRequest } from "@/lib/seat.server";

/**
 * Cash out a private call (C8d, L-39): once the venue settled it, its payout moves back into the seat's private bucket
 * and its settlement receipt is dismissed in the same transaction, so each call comes home once. Before settlement the
 * answer is "open" and nothing moves. The lease says whose call it is; the body only names it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodyWire = privateCantonCashoutRequestWire.extend({ commandId: z.uuid() });

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const parsed = bodyWire.safeParse(await jsonBody(request));
  if (!parsed.success) return NextResponse.json({ error: "expected {commandId, pairId, marketId}" }, { status: 400 });
  const { status, result } = await cashoutPrivate(auth.seat, parsed.data.pairId, parsed.data.marketId, parsed.data.commandId);
  return NextResponse.json(result, { status });
}
