import type { NextRequest } from "next/server";
import { ticketAcceptRequestWire, ticketExitRequestWire } from "@agari/markets";
import { jsonBody, recordBusy, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat's own choices on a ticket (C8c), each with `actAs` = the lease's seat party ONLY, under the commandId the
 * client journaled before sending:
 *
 *   accept        take a quote the venue issued it: a range, parlay or boost quote, a boost exit, an Earn supply or
 *                 withdrawal (`{commandId, quoteCid}`); paid from the seat's own cash, largest first
 *   claim         the owner's own settle against the Window's Resolution, passed as a disclosed contract
 *                 (`{commandId, ticketCid}`); past the refund deadline with no resolution it takes the refund
 *   refund-stale  the stale refund / void once the ticket's deadline has passed with no resolution
 *
 * A rejection maps to one of the existing Diagnosis kinds (`classifyRejection`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = ["range", "parlay", "boost", "earn"] as const;
type Product = (typeof PRODUCTS)[number];
const isProduct = (p: string): p is Product => (PRODUCTS as readonly string[]).includes(p);

export async function POST(request: NextRequest, context: { params: Promise<{ product: string; action: string }> }) {
  const { product, action } = await context.params;
  if (!isProduct(product)) return refusal("unknown", `no ticket product ${product}`, 404);
  if (action !== "accept" && action !== "claim" && action !== "refund-stale") return refusal("unknown", `no ticket action ${action}`, 404);
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const seat = { party: lease.party, leaseId: lease.leaseId };
  const raw = await jsonBody(request);
  let result;
  if (action === "accept") {
    const body = ticketAcceptRequestWire.safeParse(raw);
    if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>, quoteCid}", 400);
    result = await server.tickets.accept(seat, product, { journalId: body.data.commandId, quoteCid: body.data.quoteCid });
  } else {
    if (product === "earn") return refusal("unknown", "Earn shares are withdrawn, not claimed", 404);
    const body = ticketExitRequestWire.safeParse(raw);
    if (!body.success) return refusal("unknown", "expected {commandId: <journal uuid>, ticketCid}", 400);
    result = await server.tickets.exit(seat, product, action === "claim" ? "claim" : "refund", { journalId: body.data.commandId, ticketCid: body.data.ticketCid });
  }
  server.ledger.seats.invalidate(lease.party);
  if (result.kind === "confirmed") {
    // A new ticket pauses the seat's idle clock until its refund deadline, as an open leg does.
    const mine = await server.tickets.mine(lease.party).catch(() => null);
    if (mine && mine.busyUntilMs > auth.seat.lease.busyUntilMs) await recordBusy(auth.seat, { busyUntilMs: mine.busyUntilMs, openLegs: auth.seat.lease.openLegs });
  }
  return replyWith(result);
}
