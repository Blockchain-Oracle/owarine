import type { NextRequest } from "next/server";
import { boostTicketRequestWire, earnRequestWire, parlayTicketRequestWire, rangeTicketRequestWire } from "@agari/markets";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * A ticket's price or firm quote at click time (C8c), from ops over HMAC: `preview` / `basis` price without writing;
 * `issue` creates a firm quote for the seat's party (~20 s) or answers a requote above the cap the seat confirmed;
 * a boost's `exit` is a firm buy-back of the whole position; Earn's `supply` / `withdraw` are firm liquidity quotes.
 * The web tier never acts as the venue; WHO the quote is for comes from the lease row, never the body.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIRES = { range: rangeTicketRequestWire, parlay: parlayTicketRequestWire, boost: boostTicketRequestWire, earn: earnRequestWire } as const;
type Product = keyof typeof WIRES;
const isProduct = (p: string): p is Product => p in WIRES;
/** Ops that create something for the seat, so a cookie write's same-origin rule applies. */
const WRITES = new Set(["issue", "exit", "supply", "withdraw"]);

export async function POST(request: NextRequest, context: { params: Promise<{ product: string }> }) {
  const { product } = await context.params;
  if (!isProduct(product)) return refusal("unknown", `no ticket product ${product}`, 404);
  const parsed = WIRES[product].safeParse(await jsonBody(request));
  if (!parsed.success) return refusal("invalid-price", `bad ${product} request: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`, 400);
  const req = parsed.data;
  const auth = await seatFromRequest(request, { write: WRITES.has(req.op) });
  if (!auth.ok) return auth.response;
  const { server, lease } = auth.seat;
  const seat = { party: lease.party, leaseId: lease.leaseId };
  // A withdrawal redeems from one share contract: the seat's own shares of that reserve are merged first.
  if (product === "earn" && req.op === "withdraw") await server.tickets.mergeShares(seat, req.reserve).catch(() => undefined);
  const reply = await server.ops.ticket(product, { ...req, ...(WRITES.has(req.op) ? seat : {}) });
  if (reply.kind !== "refused" && WRITES.has(req.op)) server.ledger.seats.invalidate(lease.party);
  return replyWith(reply);
}
