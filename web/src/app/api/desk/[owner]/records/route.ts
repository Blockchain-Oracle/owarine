import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, provenViewer, refuse } from "@/features/desk/auth.server";
import { toRecord } from "@/features/desk/desk.server";
import type { RecordsPageWire } from "@/features/desk/protocol";

/** `GET /api/desk/[owner]/records?before=<seq>&limit=<n>`: the whole record, newest first, a page at a time. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PAGE = 60;

export async function GET(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner } = await context.params;
  const loaded = await loadDesk(owner);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const url = new URL(req.url);
  // C13a: the owner is the proven seat, never a typed `?viewer=`.
  if (!loaded.desk.sharePublic && (await provenViewer(req)) !== loaded.desk.owner) return refuse(404, DESK_ERRORS.notShared);
  const before = Number(url.searchParams.get("before"));
  const limit = Math.min(PAGE, Math.max(1, Number(url.searchParams.get("limit")) || PAGE));
  const rows = await loaded.store.listRecords({ deskId: loaded.desk.id, limit, ...(Number.isInteger(before) && before > 0 ? { beforeSeq: before } : {}) });
  const records = rows.map(toRecord);
  const oldest = records.at(-1);
  return answer({ records, nextBefore: records.length === limit && oldest ? oldest.seq : null } satisfies RecordsPageWire);
}
