import type { NextRequest } from "next/server";
import { grantFundRequestWire, grantOpenRequestWire, grantRevokeRequestWire } from "@agari/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own grant writes (C8f), each `actAs` the lease's seat party ONLY, under the commandId the client journaled:
 *
 *   open    GrantDesk_Open from the seat's cash (one live grant per kind)   {commandId, kind, actor, caps, expiresAtSec, budgetBase}
 *   fund    GrantDesk_Fund: top up a live grant, counters kept               {commandId, grantId, amountBase}
 *   revoke  Grant_Revoke: the whole budget back, expired or not              {commandId, grantId}
 *
 * `actor` is the agent the grant names (the X executor or a strategy's runner), never "who I am".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action !== "open" && action !== "fund" && action !== "revoke") return refusal("unknown", `no grant action ${action}`, 404);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const seat = { party: lease.party, leaseId: lease.leaseId, address: lease.address };
  const raw = await jsonBody(request);
  if (action === "open") {
    const b = grantOpenRequestWire.safeParse(raw);
    if (!b.success) return refusal("unknown", `bad grant: ${b.error.issues[0]?.path.join(".") ?? "body"}`, 400);
    return replyWith(await server.agents.openGrant(seat, { journalId: b.data.commandId, kind: b.data.kind, actor: b.data.actor, caps: b.data.caps, expiresAtSec: b.data.expiresAtSec, budgetBase: b.data.budgetBase }));
  }
  if (action === "fund") {
    const b = grantFundRequestWire.safeParse(raw);
    if (!b.success) return refusal("unknown", "expected {commandId, grantId, amountBase}", 400);
    return replyWith(await server.agents.fundGrant(seat, { journalId: b.data.commandId, grantId: b.data.grantId, amountBase: b.data.amountBase }));
  }
  const b = grantRevokeRequestWire.safeParse(raw);
  if (!b.success) return refusal("unknown", "expected {commandId, grantId}", 400);
  return replyWith(await server.agents.revokeGrant(seat, { journalId: b.data.commandId, grantId: b.data.grantId }));
}
