import type { NextRequest } from "next/server";
import { diagnosisReply, refusal, replyWith } from "@/lib/seat.server";
import { seatServer } from "@/lib/ledger.server";

/**
 * The season prize pool (C9b), as ops reads the venue's `SeasonPool`: what it holds, what it was ever funded with, when
 * the season ends and whether it has paid out. `?seasonId=` names one; otherwise the newest. Public.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const seasonId = request.nextUrl.searchParams.get("seasonId") ?? undefined;
  if (seasonId !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(seasonId)) return refusal("unknown", "not a season id", 400);
  const state = seatServer();
  if (!state.ok) return refusal("not-deployed", state.reason, 503);
  const r = await state.server.ops.gameSeason(seasonId);
  return r.ok ? replyWith(r.value) : diagnosisReply(r.diagnosis, 503);
}
