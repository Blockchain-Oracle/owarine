import { NextResponse, type NextRequest } from "next/server";
import { APP_LINK_SCHEME } from "@/features/canton-ux/seat/link";
import { readXConfig } from "@/features/x/config.server";
import { issueNativeCode } from "@/features/x/native-code.server";
import { isHandoffChallenge, isHandoffState, nativeCodePath, NATIVE_CHALLENGE_PARAM, NATIVE_STATE_PARAM, NATIVE_X_AUTH_PATH } from "@/features/x/native-handoff";
import { readSession, X_SESSION_COOKIE } from "@/features/x/session.server";
import { webEnv } from "@/lib/env";
import { requestOrigin } from "@/lib/seat.server";

/**
 * `POST /api/x/native-code` (form: `state`, `challenge`): the person's "Continue in the app" on `/native-auth` (C4d M2a,
 * K-212). Only a same-site form post from this origin, with this browser's X session cookie, gets a one-time code; the
 * answer is a 303 to `<scheme>://x-auth?code=&state=`, which the app's auth session catches. The app trades the code
 * with its PKCE verifier at `/api/x/native-exchange`; the session itself never goes into the URL.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toApp = (path: string) => new NextResponse(null, { status: 303, headers: { location: `${APP_LINK_SCHEME}://${path}`, "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (!origin || (origin !== requestOrigin(req) && origin !== webEnv.appOrigin) || (site !== null && site !== "same-origin")) {
    return NextResponse.json({ error: "confirm on this site's own page" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const state = form?.get(NATIVE_STATE_PARAM);
  const challenge = form?.get(NATIVE_CHALLENGE_PARAM);
  if (typeof state !== "string" || !isHandoffState(state) || typeof challenge !== "string" || !isHandoffChallenge(challenge)) {
    return NextResponse.json({ error: "not an app sign-in" }, { status: 400 });
  }
  const reading = readXConfig(process.env.NEXT_PUBLIC_APP_ORIGIN ?? "");
  const error = (word: string) => toApp(`${NATIVE_X_AUTH_PATH}?${new URLSearchParams({ error: word, [NATIVE_STATE_PARAM]: state }).toString()}`);
  if (!reading.configured) return error("config");
  const token = req.cookies.get(X_SESSION_COOKIE)?.value;
  if (!token || !readSession(reading.config.sessionSecret, token)) return error("state");
  return toApp(nativeCodePath(issueNativeCode({ session: token, challenge, nowMs: Date.now() }), state));
}
