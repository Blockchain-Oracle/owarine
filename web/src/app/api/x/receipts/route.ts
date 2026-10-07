import { isDbConfigured, xReceiptsByWallet } from "@owarine/db";
import type { XReceipt } from "@owarine/core/x";
import { isAddress } from "@owarine/core/types";
import { NextResponse, type NextRequest } from "next/server";
import { X_RECEIPTS_LIMIT, type XReceiptsFeed } from "@/features/x/protocol";
import { provesAddress } from "@/lib/auth/proven-seat.server";

export const dynamic = "force-dynamic";

/**
 * The mentions the relay executed for a wallet, newest first. Only to the seat itself (C4d M3: its cookie or signed read
 * header proves the address): the list ties a seat to an X account, which the public reply on X never states.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  if (!isAddress(wallet)) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  if (!(await provesAddress(req, wallet))) return NextResponse.json({ error: "only this seat can read its X receipts" }, { status: 403, headers: { "cache-control": "no-store" } });
  if (!isDbConfigured()) return NextResponse.json({ configured: false, receipts: [] } satisfies XReceiptsFeed);
  const rows = await xReceiptsByWallet(wallet, X_RECEIPTS_LIMIT);
  if (rows === null) return NextResponse.json({ configured: false, receipts: [] } satisfies XReceiptsFeed);
  const receipts: XReceipt[] = rows.map((row) => ({ ...row }));
  return NextResponse.json({ configured: true, receipts } satisfies XReceiptsFeed);
}
