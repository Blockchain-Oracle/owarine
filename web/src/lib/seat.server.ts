import "server-only";
import { SEAT_READ_HEADER } from "@agari/core/auth";
import { diagnosis, type Address, type Diagnosis, type DiagnosisKind } from "@agari/core/types";
import { toWire } from "@agari/markets";
import { NextResponse, type NextRequest } from "next/server";
import { seatCaller } from "./auth/seat-caller.server";
import { webEnv } from "./env";
import { seatServer, type SeatServer } from "./ledger.server";
import { readSeatCookie, SEAT_COOKIE, seatCookieFrom } from "./seat-cookie.server";
import type { LeaseRow } from "./seat-store.server";

/**
 * Who is calling, as a leased seat (plan §3): the ONLY source of the party a route acts or reads as. A route never
 * takes a party, an address or `actAs` from its body or query (invariant `no-party-from-request`).
 *
 * Two proofs, one answer: the HttpOnly seat cookie (web) names a lease id, or the signed seat header (the phone)
 * names an address; either way the lease row must be live and match. A cookie-authenticated write must also come from
 * our own origin and carry `x-agari-seat: 1`, which a cross-site form cannot send. A key joined to the lease by a seat
 * link (iOS step 2b) proves itself the same two ways and answers the same lease.
 */
export interface SeatContext {
  server: SeatServer;
  lease: LeaseRow;
  via: "cookie" | "header";
  /** The key that proved itself: the lease's own address, or a key joined to it by a seat link. */
  caller: string;
}

export const PRIVATE = { "cache-control": "private, no-store" } as const;
const CSRF_HEADER = "x-agari-seat";
/** Renewing on every call would write a row per read; once per this long is enough for a 15-minute idle clock. */
const TOUCH_EVERY_MS = 20_000;

export function refusal(kind: DiagnosisKind, technical: string, status: number): NextResponse {
  return NextResponse.json({ diagnosis: diagnosis(kind, technical) }, { status, headers: PRIVATE });
}

export function replyWith(body: unknown, status = 200): NextResponse {
  return NextResponse.json(toWire(body), { status, headers: PRIVATE });
}

export function diagnosisReply(d: Diagnosis, status: number): NextResponse {
  return NextResponse.json({ diagnosis: d }, { status, headers: PRIVATE });
}

/** The public origin of this request (Traefik sets `x-forwarded-*`; `TRUSTED_PROXY=forwarded` in hosting, plan §10). */
export function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}`;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === requestOrigin(request) || origin === webEnv.appOrigin;
}

export type SeatAuth = { ok: true; seat: SeatContext } | { ok: false; response: NextResponse };

export async function seatFromRequest(request: NextRequest, o: { write: boolean }): Promise<SeatAuth> {
  const state = seatServer();
  if (!state.ok) return { ok: false, response: refusal("not-deployed", state.reason, 503) };
  const server = state.server;
  const now = Date.now();

  const cookie = readSeatCookie(server.env.AGARI_SEAT_COOKIE_SECRET, request.cookies.get(SEAT_COOKIE)?.value ?? seatCookieFrom(request.headers), now);
  let lease: LeaseRow | null = null;
  let via: SeatContext["via"] = "cookie";
  let caller: string | null = cookie?.address ?? null;
  try {
    if (cookie) {
      lease = await server.store.byLease(cookie.leaseId);
      if (lease && lease.address !== cookie.address && !(await server.store.links.isLinked(cookie.address, lease.leaseId))) lease = null;
      if (lease && o.write && (!sameOrigin(request) || request.headers.get(CSRF_HEADER) !== "1")) {
        return { ok: false, response: refusal("signer-required", "a seat write must come from this site with the seat header", 403) };
      }
    }
    if (!lease && request.headers.get(SEAT_READ_HEADER)) {
      const address: Address | null = await seatCaller(request.headers, webEnv.markets.cluster, now);
      if (address) {
        lease = await server.store.byAddress(address);
        via = "header";
        caller = address;
      }
    }
  } catch (error) {
    return { ok: false, response: refusal("indexer-down", `seat store unreachable: ${error instanceof Error ? error.message : String(error)}`, 503) };
  }
  if (!lease) return { ok: false, response: refusal("signer-required", cookie ? "this seat's lease has ended; take a seat again" : "take a seat first", 401) };
  if (now - lease.lastSeenMs > TOUCH_EVERY_MS) await server.store.touch(lease.leaseId, now).catch(() => undefined);
  return { ok: true, seat: { server, lease, via, caller: caller ?? lease.address } };
}

/** After a read or write that saw the seat's contracts: its busy clock (open legs, live quotes) goes on the lease row. */
export async function recordBusy(seat: SeatContext, busy: { busyUntilMs: number; openLegs: number; nextSettleMs?: number }): Promise<void> {
  if (busy.busyUntilMs === seat.lease.busyUntilMs && busy.openLegs === seat.lease.openLegs) return;
  await seat.server.store
    .touch(seat.lease.leaseId, Date.now(), { busyUntilMs: busy.busyUntilMs, openLegs: busy.openLegs, nextSettleMs: busy.nextSettleMs ?? busy.busyUntilMs })
    .catch(() => undefined);
}

/** A JSON body, or null for anything that is not JSON. */
export async function jsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
