import { isAddress } from "@owarine/core/types";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse } from "@/features/desk/auth.server";
import { provenWriter } from "@/lib/auth/proven-seat.server";

/**
 * `POST /api/desk/[owner]/opened { owner }`: the owner opened the whole record (one of Go live's two conditions).
 * Unsigned on purpose: it unlocks nothing on its own, since going live is the owner's own seat command on Canton.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner } = await context.params;
  const loaded = await loadDesk(owner);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  // C4d L5: the owner's own seat proves it (the seat cookie, or the phone's one-request write proof); a body naming
  // the owner is not enough. The proof reads the body from a clone first, so `readJson` below still has it.
  const writer = await provenWriter(req);
  const body = (await readJson(req)) as { owner?: unknown } | null;
  if (!body || !isAddress(body.owner) || body.owner !== loaded.desk.owner || writer !== loaded.desk.owner) return refuse(403, DESK_ERRORS.notOwner);
  if (loaded.desk.recordOpenedAtSec === null) await loaded.store.markRecordOpened({ deskId: loaded.desk.id, nowSec: Math.floor(Date.now() / 1000) });
  return answer({ ok: true });
}
