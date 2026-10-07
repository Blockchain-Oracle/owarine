import { NextResponse, type NextRequest } from "next/server";
import { acceptScore, scoreClaimSchema } from "@/features/games/arcade/score.server";
import { seatVouch } from "@/features/games/room-token.server";
import { jsonBody, seatFromRequest } from "@/lib/seat.server";

/**
 * `POST /api/games/arcade/score` — a finished run, as the claim the browser makes about it: the game,
 * the room token that names the wallet, the seed, the engine build, the length, the score, the calm
 * flag and the trace. The server replays it and records only what it reproduced; the response is where
 * the run landed and the board as it now stands (Pips's `MinigameSubmit`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const parsed = scoreClaimSchema.safeParse(await jsonBody(req));
  if (!parsed.success) return NextResponse.json({ error: "that is not an arcade score" }, { status: 400 });
  // C4c (M1): a score is posted as the token's wallet only by the seat that wallet belongs to.
  const auth = await seatFromRequest(req, { write: true });
  if (!auth.ok) return NextResponse.json({ error: "take a seat first: scores are posted by a seat" }, { status: auth.response.status === 503 ? 503 : 401 });
  const verdict = await acceptScore(parsed.data, req.headers.get("x-owarine-device") ?? "", Date.now(), seatVouch(auth.seat));
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json(verdict.body);
}
