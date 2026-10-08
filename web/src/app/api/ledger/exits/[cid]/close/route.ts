import type { NextRequest } from "next/server";
import { exitCloseRequestWire } from "@owarine/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * Close through the seat's armed exit (R2): one venue command instead of a quote and an accept. The exit is the seat's
 * own standing consent to sell; ops fills it now at the venue's bid (`RestExit_Fill`), never below what the seat was
 * shown less its slippage (`minProceedsBase`) nor the floor it signed. The exit must be this seat's: ops checks the
 * owner against the lease's party, which is taken from the lease row, never the request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CID_RE = /^[0-9a-f]{40,400}$/;

export async function POST(request: NextRequest, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params;
  if (!CID_RE.test(cid)) return refusal("contract-revert", "not a contract id", 400);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const body = exitCloseRequestWire.safeParse(await jsonBody(request));
  if (!body.success) return refusal("unknown", "expected {minProceedsBase}", 400);
  const { server, lease } = auth.seat;
  const reply = await server.ops.exitClose({ party: lease.party, exitCid: cid, minProceedsBase: body.data.minProceedsBase });
  // The venue's fill changed the seat's legs and cash: its next read goes to the ledger.
  server.ledger.seats.invalidate(lease.party);
  server.ledger.seatPkg.invalidate(lease.party);
  return replyWith(reply);
}
