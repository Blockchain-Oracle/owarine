import type { NextRequest } from "next/server";
import { classifyRejection, type SeatRead } from "@agari/markets/server";
import { diagnosisReply, recordBusy, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own money, read live AS its leased party (plan §5): `balance`, `positions`, `claimables`, `quotes`. The
 * party comes from the lease row only. Every answer names the seat address, party and offset it was read as and at.
 * The address is the key that proved itself (`caller`): the lease's own, or a key joined to it by a seat link. The
 * client refuses an answer for any other address than the one it asked about, so naming the holder's key here left a
 * joined device with no balance or positions (C11b: the web joined the phone's seat and read "—").
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
  return replyWith({ value: read.value, address: auth.seat.caller, party: read.party, offset: read.offset });
}
