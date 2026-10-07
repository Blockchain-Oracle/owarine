import { addressSchema, toMarketId } from "@owarine/core/types";
import { z } from "zod";
import { reverifyMarket } from "@/features/proof/canton-proof.server";

/**
 * `POST /api/proof/pyth { market }`: re-verify an archived price (plan "Every remaining capability": on Canton the
 * reference's Pyth re-post becomes this; the path is kept). Recomputes the Window's medians, spread and outcome from the
 * Resolution's evidence with core's integer rule, checks each archived exchange response against the quote's
 * `payloadHash`, and re-fetches each exchange's public 1-minute candle. Nothing is posted anywhere. One run per Window
 * per minute is shared by every caller. Never cached by a CDN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const bodySchema = z.object({ market: addressSchema, which: z.number().int().optional() });

const refusal = (code: "bad-request" | "unavailable" | "no-print" | "unresolved", status: number, error: string) => Response.json({ error, code }, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refusal("bad-request", 400, "expected { market }");
  const outcome = await reverifyMarket(toMarketId(parsed.data.market));
  switch (outcome.kind) {
    case "report":
      return Response.json({ report: outcome.report, atMs: outcome.atMs }, { headers: NO_STORE });
    case "unresolved":
      return refusal("unresolved", 409, "this Window has no Resolution yet");
    case "unknown":
      return refusal("no-print", 404, "the projection holds no such Window");
    case "unavailable":
      return refusal("unavailable", 503, "the projection is not reachable on this deployment");
  }
}
