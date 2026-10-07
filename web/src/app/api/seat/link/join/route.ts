import { SEAT_LINK_CONFIRM_MS } from "@owarine/markets";
import { type NextRequest } from "next/server";
import { ipBucket, rateLimitKey } from "@/lib/client-ip.server";
import { seatServer } from "@/lib/ledger.server";
import { mintSeatCookie, SEAT_COOKIE, SEAT_COOKIE_TTL_MS } from "@/lib/seat-cookie.server";
import { leaseRules, leaseView } from "@/lib/seat-lease.server";
import { checkJoinRequest } from "@/lib/seat-link.server";
import { jsonBody, refusal, replyWith, requestOrigin, serverFault } from "@/lib/seat.server";

/**
 * The seat link, joiner's half (plan, iOS step 2b): this device's key signs `seatLinkText` naming the code another
 * device showed, and claims it. The holder's device then allows or refuses this key (C4c, review L1); the request
 * waits for that answer (at most `SEAT_LINK_CONFIRM_MS`). Allowed, the answer is the joined lease, and on web the seat
 * cookie for this key, so the browser proves the shared seat as the holder's does. Unknown, expired, used and locked
 * codes get one answer; attempts are limited per IP (an IPv6 address by its /64), and every miss counts against every
 * live code, so a guess learns nothing and many addresses guess no faster.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOINS_PER_MINUTE = 10;
/** How often the waiting join looks for the holder's answer. */
const DECISION_POLL_MS = 1_000;
const attempts = new Map<string, number[]>();

function limited(ip: string, nowMs: number): boolean {
  const recent = (attempts.get(ip) ?? []).filter((t) => nowMs - t < 60_000);
  recent.push(nowMs);
  attempts.set(ip, recent);
  if (attempts.size > 4096) for (const [key, times] of attempts) if (times.every((t) => nowMs - t >= 60_000)) attempts.delete(key);
  return recent.length > JOINS_PER_MINUTE;
}

export async function POST(request: NextRequest) {
  const state = seatServer();
  if (!state.ok) return replyWith({ kind: "not-live", reason: state.reason }, 503);
  const server = state.server;
  const now = Date.now();
  if (limited(ipBucket(rateLimitKey(request)), now)) return refusal("faucet-refused", "too many link attempts from this address; wait a minute", 429);
  const check = await checkJoinRequest(await jsonBody(request), now);
  if (!check.ok) return refusal("signer-required", check.reason, 400);
  let outcome;
  try {
    outcome = await server.store.links.redeem(check.code, check.address, now);
  } catch (error) {
    return serverFault("indexer-down", "seat store unreachable", error, 503);
  }
  if (outcome.kind === "invalid") return refusal("signer-required", "that code has expired or was already used; ask the other device for a new one", 410);
  if (outcome.kind === "own-seat") return refusal("signer-required", "this device holds a seat of its own; reset it here first, then join", 409);
  if (outcome.kind === "pending") {
    // The key maps only once the holder's device allows it: wait here for that answer.
    // Bounded by the confirm window (plus a poll of slack): a store fault never holds the request open forever.
    const until = Date.now() + SEAT_LINK_CONFIRM_MS + DECISION_POLL_MS;
    let answer = "pending";
    while (answer === "pending" && Date.now() < until) {
      await new Promise((r) => setTimeout(r, DECISION_POLL_MS));
      answer = await server.store.links.claimState(check.code, check.address, Date.now()).catch(() => "pending");
      if (request.signal.aborted) return refusal("signer-required", "the join was abandoned", 499);
    }
    if (answer === "declined") return refusal("signer-required", "the other device did not allow this one; ask it for a new code if that was a mistake", 403);
    if (answer !== "linked") return refusal("signer-required", "the other device did not answer in time; ask it for a new code", 410);
  }
  const lease = await server.store.byLease(outcome.leaseId);
  if (!lease) return refusal("signer-required", "that seat's lease has just ended; take a seat on the other device again", 410);
  const response = replyWith(leaseView(lease, leaseRules(server)));
  const cookie = mintSeatCookie(server.env.OWARINE_SEAT_COOKIE_SECRET, lease.leaseId, check.address, now);
  const secure = requestOrigin(request).startsWith("https://");
  response.cookies.set({ name: SEAT_COOKIE, value: cookie.value, httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SEAT_COOKIE_TTL_MS / 1000 });
  return response;
}
