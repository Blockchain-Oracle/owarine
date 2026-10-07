import { addressSchema } from "@owarine/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { commitDraw } from "@/features/games/lucky/lucky.server";
import { provenWriter } from "@/lib/auth/proven-seat.server";

/**
 * `POST /api/games/lucky/commit {wallet, stakeBase}` — the server draws its seed, hashes it, and hands the
 * hash back before anything else happens. The reels start on this; the browser chooses its own seed only
 * after it has seen it, which is what makes the draw provable rather than merely random. The wallet must be the
 * caller's own seat (C4d M3: the seat cookie, or the phone's one-request write proof); a body cannot name another's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ wallet: addressSchema, stakeBase: z.string().regex(/^\d+$/) });

export async function POST(req: Request) {
  // The proof reads the body from a clone first, so the parse below still has it.
  const writer = await provenWriter(req);
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "that is not a spin" }, { status: 400 });
  if (writer !== parsed.data.wallet) return NextResponse.json({ error: "spin from your own seat" }, { status: 403 });
  const verdict = await commitDraw({ wallet: parsed.data.wallet, stakeBase: BigInt(parsed.data.stakeBase), device: req.headers.get("x-owarine-device") ?? "", nowMs: Date.now() });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json(verdict.wire);
}
