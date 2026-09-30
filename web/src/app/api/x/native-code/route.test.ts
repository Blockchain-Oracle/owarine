import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { challengeOf, redeemNativeCode } from "@/features/x/native-code.server";
import { signSession, X_SESSION_COOKIE } from "@/features/x/session.server";

/**
 * C4d M2a (K-212): only the person's own confirmation on this site (a same-origin form post with the X session cookie)
 * sends the app anything, and what it sends is a one-time code, never the session.
 */
const SECRET = "s".repeat(40);
vi.mock("@/features/x/config.server", () => ({ readXConfig: () => ({ configured: true, config: { sessionSecret: SECRET } }) }));
vi.mock("@/lib/seat.server", () => ({ requestOrigin: () => "https://site.test" }));
vi.mock("@/lib/env", () => ({ webEnv: { appOrigin: "https://site.test" } }));

const { POST } = await import("./route");
const STATE = "ab".repeat(16);
const VERIFIER = "v".repeat(43);
const session = signSession(SECRET, { authorId: "42", handle: "abu", t: Date.now() });

const post = (headers: Record<string, string>, cookie = true) =>
  POST(new NextRequest("https://site.test/api/x/native-code", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie: `${X_SESSION_COOKIE}=${session}` } : {}), ...headers },
    body: new URLSearchParams({ state: STATE, challenge: challengeOf(VERIFIER) }).toString(),
  }));

describe("POST /api/x/native-code", () => {
  it("answers the confirming browser with a one-time code on the app's scheme, never the session", async () => {
    const res = await post({ origin: "https://site.test", "sec-fetch-site": "same-origin" });
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^[a-z][a-z0-9+.-]*:\/\/x-auth\?code=/);
    expect(location).not.toContain(session);
    const code = new URLSearchParams(location.slice(location.indexOf("?") + 1)).get("code") ?? "";
    expect(new URLSearchParams(location.slice(location.indexOf("?") + 1)).get("state")).toBe(STATE);
    expect(redeemNativeCode({ code, verifier: VERIFIER, nowMs: Date.now() })).toBe(session);
  });

  it("refuses a post from another site, or with no origin at all", async () => {
    expect((await post({ origin: "https://evil.test" })).status).toBe(403);
    expect((await post({ origin: "https://site.test", "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await post({})).status).toBe(403);
  });

  it("without an X session it tells the app, and issues nothing", async () => {
    const res = await post({ origin: "https://site.test" }, false);
    expect(res.headers.get("location")).toMatch(/x-auth\?error=state&state=/);
  });
});
