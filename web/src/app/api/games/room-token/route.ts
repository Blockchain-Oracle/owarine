import { messageSignatureSchema } from "@agari/core/auth";
import { addressSchema } from "@agari/core/types";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mintFromSignature, renewFromToken, roomArena, seatVouch } from "@/features/games/room-token.server";
import { seatFromRequest } from "@/lib/seat.server";

/**
 * `POST /api/games/room-token` — the browser key's signature, turned into a room credential. The wallet
 * is never asked; the key signs for the wallet it claims, and the seat the request proves (cookie or signed
 * header) must vouch for that wallet: its own key, or a key of the same live lease (C4c).
 *
 * Two shapes, because a duel outlives one token. A `signature` mints a fresh session; a `token` renews
 * inside the session it already proved, so a match that runs past fifteen minutes re-signs nothing
 * mid-swipe. Both return the same grant, and the ops room server checks it without ever calling back here.
 *
 * The route never says which claim it disliked beyond the shape a client can act on — mint again, or
 * stop — and it holds no session of its own: there is nothing here to invalidate, and nothing to leak.
 */
export const runtime = "nodejs";

/**
 * `GET` — what a browser needs to know BEFORE it asks a wallet to sign.
 *
 * The arena, the chain and where the room listens: three public facts, no secret among them. The chain
 * and arena let the client build the exact message the mint will verify, from core's own builder, so the
 * two copies of that text cannot drift.
 */
export async function GET() {
  const target = await roomArena();
  return NextResponse.json({
    chainId: target?.chainId ?? null,
    arena: target?.arena ?? null,
    url: process.env.GAME_ROOM_PUBLIC_URL ?? null,
  });
}

const requestSchema = z.union([
  z.object({
    wallet: addressSchema,
    key: addressSchema,
    issuedAtMs: z.number().int().positive(),
    signature: messageSignatureSchema,
  }),
  z.object({ token: z.string().min(16).max(400) }),
]);

export async function POST(req: NextRequest) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That is not a room token request." }, { status: 400 });

  // C4c (M1): only a seat the request proves can vouch for the wallet a token names.
  const auth = await seatFromRequest(req, { write: false });
  if (!auth.ok) return NextResponse.json({ error: "Take a seat first: the duel room admits seats." }, { status: auth.response.status === 503 ? 503 : 401 });
  const vouch = seatVouch(auth.seat);

  const now = Date.now();
  const outcome =
    "token" in parsed.data
      ? await renewFromToken(parsed.data.token, now, vouch)
      : await mintFromSignature(parsed.data.wallet, parsed.data.key, parsed.data.issuedAtMs, parsed.data.signature, now, vouch);

  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json(outcome.grant);
}
