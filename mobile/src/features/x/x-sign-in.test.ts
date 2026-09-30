import { beforeEach, describe, expect, it, vi } from "vitest";

/** C13a (K-145): the phone keeps an X session only from a handoff it started, identified by its own nonce. */
const opened: { state: string; returnUrl: string }[] = [];
let answer: (state: string) => { type: "success"; url: string } | { type: "cancel" } = () => ({ type: "cancel" });
const stored: (string | null)[] = [];

vi.mock("~/lib/external", () => ({
  openXSignIn: async (state: string, returnUrl: string) => {
    opened.push({ state, returnUrl });
    return answer(state);
  },
}));
vi.mock("~/lib/identity", () => ({ appUrl: (path: string) => `appscheme://${path}` }));
vi.mock("./x-session", () => ({ setForwardedXSession: async (t: string | null) => void stored.push(t) }));

const { signInWithX } = await import("./x-sign-in");

describe("signInWithX", () => {
  beforeEach(() => {
    opened.length = 0;
    stored.length = 0;
  });

  it("opens the handoff with a fresh 16-byte nonce and returns on the app's own scheme", async () => {
    answer = () => ({ type: "cancel" });
    expect(await signInWithX()).toEqual({ ok: false, reason: "cancelled" });
    expect(opened[0]?.state).toMatch(/^[0-9a-f]{32}$/);
    expect(opened[0]?.returnUrl).toBe("appscheme://x-auth");
    await signInWithX();
    expect(opened[1]?.state).not.toBe(opened[0]?.state);
    expect(stored).toEqual([]);
  });

  it("keeps the session only when the nonce is its own", async () => {
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?session=body.sig&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: true });
    expect(stored).toEqual(["body.sig"]);
    answer = () => ({ type: "success", url: `appscheme://x-auth?session=evil.sig&state=${"ab".repeat(16)}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "state" });
    expect(stored).toEqual(["body.sig"]);
  });

  it("maps the web's failure words and nothing else", async () => {
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?error=denied&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "denied" });
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?error=%3Cscript%3E&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "server" });
  });
});
