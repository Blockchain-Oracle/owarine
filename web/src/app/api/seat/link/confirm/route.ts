import { type NextRequest } from "next/server";
import { normalizeSeatLinkCode, SEAT_LINK_CODE_LENGTH } from "@agari/markets";
import { z } from "zod";
import { jsonBody, refusal, replyWith, seatFromRequest } from "@/lib/seat.server";

/**
 * The seat link, the holder's answer (C4c, security review L1): a code another device used only claims it, and the key
 * joins this seat when the device that took the seat says so here. `{code, allow}`: allowed, the key joins the lease
 * now; refused, it never does, and the code is spent. Only the lease's own key answers (the cookie with the seat
 * header on web, the signed seat header on the phone), and only within `SEAT_LINK_CONFIRM_MS` of the claim.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.strictObject({ code: z.string(), allow: z.boolean() });

export async function POST(request: NextRequest) {
  const auth = await seatFromRequest(request, { write: true });
  if (!auth.ok) return auth.response;
  const { server, lease, caller } = auth.seat;
  if (caller !== lease.address) return refusal("signer-required", "only the device that took this seat can allow another onto it", 403);
  const parsed = body.safeParse(await jsonBody(request));
  const code = parsed.success ? normalizeSeatLinkCode(parsed.data.code) : null;
  if (!parsed.success || !code) return refusal("signer-required", `expected {code: ${SEAT_LINK_CODE_LENGTH} letters and numbers, allow: true | false}`, 400);
  let decided;
  try {
    decided = await server.store.links.decide(code, lease.leaseId, parsed.data.allow, Date.now());
  } catch (error) {
    return refusal("indexer-down", `seat store unreachable: ${error instanceof Error ? error.message : String(error)}`, 503);
  }
  if (decided === "gone") return refusal("signer-required", "no device is waiting on that code any more; show a new one", 410);
  return replyWith({ state: decided });
}
