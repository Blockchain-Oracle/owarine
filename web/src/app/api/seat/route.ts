import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/client-ip.server";
import { seatServer } from "@/lib/ledger.server";
import { mintSeatCookie, SEAT_COOKIE, SEAT_COOKIE_TTL_MS } from "@/lib/seat-cookie.server";
import { checkLeaseRequest, leaseRules, leaseView, takeSeat } from "@/lib/seat-lease.server";
import { jsonBody, PRIVATE, refusal, replyWith, requestOrigin, seatFromRequest } from "@/lib/seat.server";

/**
 * The guest seat (plan §4): `POST` takes or renews a lease on an explicit, seat-signed request; `GET` reads it;
 * `DELETE` lets it go. The lease sets an HttpOnly cookie; the phone proves the seat with its signed header instead.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lease attempts per IP per minute: a lease is a click, not a loop. */
const LEASE_PER_MINUTE = 12;
const attempts = new Map<string, number[]>();

function limited(ip: string, nowMs: number): boolean {
  const recent = (attempts.get(ip) ?? []).filter((t) => nowMs - t < 60_000);
  recent.push(nowMs);
  attempts.set(ip, recent);
  if (attempts.size > 4096) for (const [key, times] of attempts) if (times.every((t) => nowMs - t >= 60_000)) attempts.delete(key);
  return recent.length > LEASE_PER_MINUTE;
}

const secure = (request: NextRequest) => requestOrigin(request).startsWith("https://");

export async function POST(request: NextRequest) {
  const state = seatServer();
  if (!state.ok) return replyWith({ kind: "not-live", reason: state.reason }, 503);
  const now = Date.now();
  if (limited(clientIp(request) ?? "unknown", now)) return refusal("faucet-refused", "too many seat requests from this address; wait a minute", 429);
  const check = await checkLeaseRequest(await jsonBody(request), now);
  if (!check.ok) return refusal("signer-required", check.reason, 400);
  let view;
  try {
    view = await takeSeat(state.server, check.address, now);
  } catch (error) {
    return refusal("rpc-down", `could not take a seat: ${error instanceof Error ? error.message : String(error)}`, 503);
  }
  if (view.kind !== "leased") return replyWith(view, view.kind === "pool-full" ? 409 : 200);
  const response = replyWith(view);
  const cookie = mintSeatCookie(state.server.env.AGARI_SEAT_COOKIE_SECRET, view.leaseId, check.address, now);
  response.cookies.set({ name: SEAT_COOKIE, value: cookie.value, httpOnly: true, sameSite: "lax", secure: secure(request), path: "/", maxAge: SEAT_COOKIE_TTL_MS / 1000 });
  return response;
}

export async function GET(request: NextRequest) {
  const state = seatServer();
  if (!state.ok) return replyWith({ kind: "not-live", reason: state.reason });
  const auth = await seatFromRequest(request, { write: false });
  if (!auth.ok) return auth.response.status === 401 ? replyWith({ kind: "none" }) : auth.response;
  return replyWith(leaseView(auth.seat.lease, leaseRules(auth.seat.server)));
}

export async function DELETE(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  // A joined device's reset takes only its own key off the seat; the device that holds the lease drains it.
  if (auth.seat.caller !== auth.seat.lease.address) await auth.seat.server.store.links.unlink(auth.seat.caller);
  else await auth.seat.server.store.release(auth.seat.lease.leaseId, Date.now(), "released");
  const response = NextResponse.json({ kind: "none" }, { headers: PRIVATE });
  response.cookies.set({ name: SEAT_COOKIE, value: "", httpOnly: true, sameSite: "lax", secure: secure(request), path: "/", maxAge: 0 });
  return response;
}
