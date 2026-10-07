import { type NextRequest } from "next/server";
import { issueSeatLink } from "@/lib/seat-link.server";
import { normalizeSeatLinkCode, SEAT_LINK_CODE_LENGTH } from "@owarine/markets";
import { refusal, replyWith, seatFromRequest, serverFault } from "@/lib/seat.server";

/**
 * The seat link, holder's half (plan, iOS step 2b): `POST` gives the seat this device holds a one-time code (60 s,
 * single use) for another device to join with; `GET ?code=` says whether that code is still showing, ran out, waits
 * for this device to allow the key that used it (`pending`, C4c), or was allowed or refused, so the holder's screen
 * asks and then turns to "Linked" by itself (`/api/seat/link/confirm` carries the answer). Only the lease's own key shows codes, proven by the seat cookie (web,
 * same-origin with the seat header) or the signed seat header (the phone); a joined device cannot pass the seat on.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease, caller } = auth.seat;
  if (caller !== lease.address) return refusal("signer-required", "only the device that took this seat can show a link code", 403);
  let issued;
  try {
    issued = await issueSeatLink(server, lease, Date.now());
  } catch (error) {
    return serverFault("indexer-down", "seat store unreachable", error, 503);
  }
  if (!issued.ok) return refusal("faucet-refused", issued.reason, 429);
  return replyWith({ code: issued.code, expiresAtMs: issued.expiresAtMs });
}

export async function GET(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response;
  const code = normalizeSeatLinkCode(request.nextUrl.searchParams.get("code") ?? "");
  if (!code) return refusal("signer-required", `a link code is ${SEAT_LINK_CODE_LENGTH} letters and numbers`, 400);
  const state = await auth.seat.server.store.links.codeState(code, auth.seat.lease.leaseId, Date.now()).catch(() => undefined);
  if (state === undefined) return refusal("indexer-down", "seat store unreachable", 503);
  if (state === null) return refusal("signer-required", "no such code for this seat", 404);
  // Only the holder is shown which key waits on its code (C4c): it is the one that allows it.
  return replyWith({ state: state.state, device: auth.seat.caller === auth.seat.lease.address ? state.device : null });
}
