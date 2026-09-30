import { describe, expect, it } from "vitest";
import { challengeOf, issueNativeCode, NATIVE_CODE_TTL_MS, redeemNativeCode } from "./native-code.server";
import { nativeCodePath, nativeHandoffStep } from "./native-handoff";

/**
 * C13a, hardened in C4d M2a (K-212): the `/native-auth` handoff's decisions, and the one-time code the app trades with
 * its PKCE verifier. Before C4d a signed-in browser's page load alone redirected the X session itself into the app
 * scheme, so any app's auth session could collect it.
 */
const STATE = "ab".repeat(16);
const VERIFIER = "v".repeat(43);
const CHALLENGE = challengeOf(VERIFIER);
const base = { state: STATE, challenge: CHALLENGE, result: null, reason: null, configured: true, session: null };

describe("native X sign-in handoff", () => {
  it("never sends a request without the app's nonce and challenge into an app scheme", () => {
    for (const state of [null, "", "short", "ZZ".repeat(16), `${STATE}&session=x`]) {
      expect(nativeHandoffStep({ ...base, state, session: { handle: "h" } })).toEqual({ kind: "page" });
    }
    for (const challenge of [null, "", "short", `${CHALLENGE}=`]) expect(nativeHandoffStep({ ...base, challenge, session: { handle: "h" } })).toEqual({ kind: "page" });
  });

  it("starts the ordinary X sign-in and comes back with the same nonce and challenge", () => {
    const step = nativeHandoffStep(base);
    expect(step.kind).toBe("begin");
    const to = new URL((step as { to: string }).to, "https://h");
    expect(to.pathname).toBe("/api/x/start");
    const back = new URL(to.searchParams.get("return") ?? "", "https://h");
    expect([back.pathname, back.searchParams.get("state"), back.searchParams.get("challenge")]).toEqual(["/native-auth", STATE, CHALLENGE]);
  });

  it("signed in, it asks the person first and never puts the session in a URL", () => {
    for (const result of [null, "1"]) {
      const step = nativeHandoffStep({ ...base, result, session: { handle: "abu" } });
      expect(step).toEqual({ kind: "consent", handle: "abu", state: STATE, challenge: CHALLENGE });
    }
    expect(nativeCodePath("c0de", STATE)).toBe(`x-auth?code=c0de&state=${STATE}`);
  });

  it("tells the app why it failed, in known words only, and never loops", () => {
    expect(nativeHandoffStep({ ...base, result: "err", reason: "denied" })).toEqual({ kind: "app", path: `x-auth?error=denied&state=${STATE}` });
    expect(nativeHandoffStep({ ...base, result: "err", reason: "<script>" })).toEqual({ kind: "app", path: `x-auth?error=server&state=${STATE}` });
    expect(nativeHandoffStep({ ...base, result: "1" })).toEqual({ kind: "app", path: `x-auth?error=state&state=${STATE}` });
    expect(nativeHandoffStep({ ...base, configured: false })).toEqual({ kind: "app", path: `x-auth?error=config&state=${STATE}` });
  });
});

describe("the handoff's one-time code (PKCE S256)", () => {
  const NOW = 1_800_000_000_000;

  it("gives the session once, only for the verifier whose challenge opened the handoff", () => {
    const code = issueNativeCode({ session: "body.sig", challenge: CHALLENGE, nowMs: NOW });
    expect(redeemNativeCode({ code, verifier: VERIFIER, nowMs: NOW + 1_000 })).toBe("body.sig");
    expect(redeemNativeCode({ code, verifier: VERIFIER, nowMs: NOW + 2_000 })).toBeNull();
  });

  it("an app that caught the code without the verifier gets nothing, and the code is spent", () => {
    const code = issueNativeCode({ session: "body.sig", challenge: CHALLENGE, nowMs: NOW });
    expect(redeemNativeCode({ code, verifier: "w".repeat(43), nowMs: NOW + 1_000 })).toBeNull();
    expect(redeemNativeCode({ code, verifier: VERIFIER, nowMs: NOW + 1_000 })).toBeNull();
  });

  it("lapses after a minute", () => {
    const code = issueNativeCode({ session: "body.sig", challenge: CHALLENGE, nowMs: NOW });
    expect(redeemNativeCode({ code, verifier: VERIFIER, nowMs: NOW + NATIVE_CODE_TTL_MS + 1 })).toBeNull();
  });
});
