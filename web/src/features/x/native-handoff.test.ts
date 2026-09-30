import { describe, expect, it } from "vitest";
import { nativeHandoffStep } from "./native-handoff";

/** C13a: the `/native-auth` handoff's decisions; the page adds the app's scheme and the session cookie. */
const STATE = "ab".repeat(16);
const base = { state: STATE, result: null, reason: null, configured: true, session: null };

describe("native X sign-in handoff", () => {
  it("never sends a request without the app's nonce into an app scheme", () => {
    for (const state of [null, "", "short", "ZZ".repeat(16), `${STATE}&session=x`]) {
      expect(nativeHandoffStep({ ...base, state, session: "tok" })).toEqual({ kind: "page" });
    }
  });

  it("starts the ordinary X sign-in and comes back with the same nonce", () => {
    const step = nativeHandoffStep(base);
    expect(step.kind).toBe("begin");
    const to = new URL((step as { to: string }).to, "https://h");
    expect(to.pathname).toBe("/api/x/start");
    expect(to.searchParams.get("return")).toBe(`/native-auth?state=${STATE}`);
  });

  it("hands the signed session to the app with the nonce", () => {
    const step = nativeHandoffStep({ ...base, result: "1", session: "body.sig" });
    expect(step).toEqual({ kind: "app", path: `x-auth?session=body.sig&state=${STATE}` });
  });

  it("tells the app why it failed, in known words only, and never loops", () => {
    expect(nativeHandoffStep({ ...base, result: "err", reason: "denied" })).toEqual({ kind: "app", path: `x-auth?error=denied&state=${STATE}` });
    expect(nativeHandoffStep({ ...base, result: "err", reason: "<script>" })).toEqual({ kind: "app", path: `x-auth?error=server&state=${STATE}` });
    expect(nativeHandoffStep({ ...base, result: "1" })).toEqual({ kind: "app", path: `x-auth?error=state&state=${STATE}` });
    expect(nativeHandoffStep({ ...base, configured: false })).toEqual({ kind: "app", path: `x-auth?error=config&state=${STATE}` });
  });
});
