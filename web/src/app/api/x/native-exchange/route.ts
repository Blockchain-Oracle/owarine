import { NextResponse } from "next/server";
import { z } from "zod";
import { redeemNativeCode } from "@/features/x/native-code.server";
import { isHandoffVerifier } from "@/features/x/native-handoff";

/**
 * `POST /api/x/native-exchange { code, verifier }`: the app's half of the X sign-in handoff (C4d M2a, K-212). The one-time
 * code from `/api/x/native-code` and the PKCE verifier whose S256 challenge opened the handoff give back the signed X
 * session, once, within 60 seconds. Anything else is a plain 400: which part was wrong is not said.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const bodySchema = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/), verifier: z.string().refine(isHandoffVerifier) });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  const session = redeemNativeCode({ code: parsed.data.code, verifier: parsed.data.verifier, nowMs: Date.now() });
  if (!session) return NextResponse.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ session }, { headers: NO_STORE });
}
