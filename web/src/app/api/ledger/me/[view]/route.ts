import type { NextRequest } from "next/server";
import { classifyRejection, type SeatRead } from "@agari/markets/server";
import { diagnosisReply, recordBusy, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own money, read live AS its leased party (plan §5): `balance`, `positions`, `claimables`, `quotes`. The
 * party comes from the lease row only. Every answer names the seat address, party and offset it was read as and at.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEWS = ["balance", "positions", "claimables", "quotes"] as const;
type View = (typeof VIEWS)[number];
const isView = (v: string): v is View => (VIEWS as readonly string[]).includes(v);

export async function GET(request: NextRequest, context: { params: Promise<{ view: string }> }) {
  const { view } = await context.params;
  if (!isView(view)) return refusal("unknown", `no seat view ${view}`, 404);
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  let read: SeatRead<unknown>;
  try {
    read = await server.ledger[view](lease.party);
  } catch (error) {
    return diagnosisReply(classifyRejection(error, { step: "read" }), 503);
  }
  await recordBusy(auth.seat, read);
  return replyWith({ value: read.value, address: lease.address, party: read.party, offset: read.offset });
}
