import { isDbConfigured, xGetRelayHealth } from "@owarine/db";
import { NextResponse, type NextRequest } from "next/server";
import { X_HANDLE } from "@/features/x/copy";
import { executorAddress } from "@/features/x/config.server";
import { findBinding, readXGate } from "@/features/x/gate.server";
import type { XStatus } from "@/features/x/protocol";
import { publicOrigin } from "@/lib/client-ip.server";

export const dynamic = "force-dynamic";

/**
 * Who is signed in here, and which account routes to the wallet asked about — two facts the
 * reference keeps apart (`api/claim/x/me`): a missing cookie is not an unlinked wallet.
 */
export async function GET(req: NextRequest) {
  try {
    return await status(req);
  } catch (error) {
    // C9e: a store or gate failure is said as one (JSON 503), never a bodiless 500 the page would read as "not configured".
    console.error("x status failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "the X link store could not be read just now" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

async function status(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const gate = await readXGate(publicOrigin(req));
  const storeConfigured = isDbConfigured();
  const relay = storeConfigured ? await xGetRelayHealth().catch(() => null) : null;
  const base = { storeConfigured, executor: executorAddress(), handle: X_HANDLE, relay };
  if (!gate.configured) {
    const binding = storeConfigured ? await findBinding(null, wallet) : null;
    return NextResponse.json({ ...base, configured: false, missing: gate.missing, signedIn: false, session: null, binding } satisfies XStatus);
  }
  const binding = storeConfigured ? await findBinding(gate.session, wallet) : null;
  const session = gate.session ? { authorId: gate.session.authorId, handle: gate.session.handle } : null;
  return NextResponse.json({ ...base, configured: true, missing: [], signedIn: session !== null, session, binding } satisfies XStatus);
}
