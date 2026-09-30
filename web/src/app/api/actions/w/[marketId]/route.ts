import { marketIdSchema } from "@agari/core/types";
import { actionHeaders, windowAction, X_REFUSAL_DETAILS } from "@agari/core/x";
import { ensureMarkets, marketsProvider } from "@agari/markets";
import { buildWindowShareAction } from "@agari/markets/x";
import { webEnv } from "@/lib/env";
import { regionRestricted } from "@/lib/region.server";
import { publicOrigin } from "@/lib/client-ip.server";
import { windowShareKey } from "@/lib/share-link.server";

/**
 * `GET|POST /api/actions/w/<marketId>` — one Window as a card (S11, `00-plan.md` §S11; adapted in C13a).
 *
 * A card client `GET`s the card (the reference's shape: Up and Down, each with an amount field), then `POST`s to the
 * button's href and follows the link it gets back. On Canton that link is a signed Window share link to this Window's
 * ticket (web, or the app through the same https path), built in `@agari/markets/x`; no transaction, no chain id.
 * This file stays what every other route is: policy plus serialization.
 *
 * The POST keeps the reference's geofence answer (D-095): a held region reads the card but is not handed a link into a
 * funded ticket. The GET is a read and does not check it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The host actually serving this card, so a preview deployment and the real domain both render their own icon. */
function origin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return webEnv.appOrigin.replace(/\/$/, "");
  return publicOrigin(request);
}

const headers = () => actionHeaders();
const fail = (message: string, status: number) => Response.json({ message }, { status, headers: headers() });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: headers() });
}

export async function GET(request: Request, { params }: { params: Promise<{ marketId: string }> }) {
  const marketId = marketIdSchema.safeParse((await params).marketId);
  if (!marketId.success) return fail("That is not a Window address.", 400);
  ensureMarkets(webEnv.markets);

  const reading = await marketsProvider.getMarket(marketId.data);
  if (!reading.ok) return fail(X_REFUSAL_DETAILS["market-data-unavailable"], 503);
  if (!reading.value) return fail(X_REFUSAL_DETAILS["no-window"], 404);

  const base = origin(request);
  const body = windowAction({
    market: reading.value,
    icon: `${base}/icons/icon-512.png`,
    basePath: `${base}/api/actions/w/${marketId.data}`,
    nowMs: marketsProvider.nowMs(),
  });
  return Response.json(body, { headers: headers() });
}

export async function POST(request: Request, { params }: { params: Promise<{ marketId: string }> }) {
  if (regionRestricted(request)) return fail("Funded actions are unavailable in your region.", 451);

  const marketId = marketIdSchema.safeParse((await params).marketId);
  if (!marketId.success) return fail("That is not a Window address.", 400);

  const url = new URL(request.url);
  const side = url.searchParams.get("side");
  if (side !== "up" && side !== "down") return fail("Choose Up or Down.", 400);

  ensureMarkets(webEnv.markets);
  const built = await buildWindowShareAction({ marketId: marketId.data, side, stakeText: url.searchParams.get("stake"), origin: origin(request), key: windowShareKey() });
  if (!built.ok) return fail(built.message, built.status);
  return Response.json(built.response, { headers: headers() });
}
