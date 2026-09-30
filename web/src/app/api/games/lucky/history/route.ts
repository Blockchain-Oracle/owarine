import type { Address } from "@agari/core/types";
import { isAddress } from "@agari/core/types";
import { NextResponse } from "next/server";
import { luckyHistory } from "@/features/games/lucky/lucky-settle.server";
import { provesAddress } from "@/lib/auth/proven-seat.server";

/**
 * `GET /api/games/lucky/history?address=<base58>` — a wallet's spins, newest first, with the streak its settled
 * ones add up to. Reading it is what reconciles the open rows against the chain, so the answer is as
 * current as the venue is; `configured: false` is the honest answer on a deployment with no store. Only the seat
 * itself reads it (C4d M3: its cookie or signed read header proves the address).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !isAddress(address)) return NextResponse.json({ error: "address required" }, { status: 400 });
  if (!(await provesAddress(request, address))) return NextResponse.json({ error: "only this seat can read its spins" }, { status: 403 });
  return NextResponse.json(await luckyHistory(address as Address));
}
