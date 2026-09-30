import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * C13a (K-145), hardened in C4d M2a (K-212): the phone opens the handoff with its own nonce and a PKCE S256 challenge,
 * keeps an X session only from a handoff it started, and gets the session only by trading the one-time code with the
 * verifier it kept.
 */
const opened: { state: string; challenge: string; returnUrl: string }[] = [];
let answer: (state: string) => { type: "success"; url: string } | { type: "cancel" } = () => ({ type: "cancel" });
const stored: (string | null)[] = [];
const exchanges: { code: string; verifier: string }[] = [];

vi.mock("~/lib/external", () => ({
  openXSignIn: async (state: string, challenge: string, returnUrl: string) => {
    opened.push({ state, challenge, returnUrl });
    return answer(state);
  },
}));
vi.mock("~/lib/identity", () => ({ appUrl: (path: string) => `appscheme://${path}` }));
vi.mock("./x-session", () => ({ setForwardedXSession: async (t: string | null) => void stored.push(t) }));

/** The web's exchange: the session only for the verifier whose challenge the handoff was opened with. */
vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body)) as { code: string; verifier: string };
  exchanges.push(body);
  const challenge = createHash("sha256").update(body.verifier).digest("base64url");
  const ok = url === "/api/x/native-exchange" && init.method === "POST" && body.code === "c0de" && challenge === opened.at(-1)?.challenge;
  return new Response(JSON.stringify(ok ? { session: "body.sig" } : { error: "invalid" }), { status: ok ? 200 : 400 });
});

const { signInWithX, pkcePair } = await import("./x-sign-in");

describe("signInWithX", () => {
  beforeEach(() => {
    opened.length = 0;
    stored.length = 0;
    exchanges.length = 0;
  });

  it("opens the handoff with a fresh 16-byte nonce and an S256 challenge, and returns on the app's own scheme", async () => {
    answer = () => ({ type: "cancel" });
    expect(await signInWithX()).toEqual({ ok: false, reason: "cancelled" });
    expect(opened[0]?.state).toMatch(/^[0-9a-f]{32}$/);
    expect(opened[0]?.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(opened[0]?.returnUrl).toBe("appscheme://x-auth");
    await signInWithX();
    expect(opened[1]?.state).not.toBe(opened[0]?.state);
    expect(opened[1]?.challenge).not.toBe(opened[0]?.challenge);
    expect(stored).toEqual([]);
  });

  it("a PKCE pair's challenge is the base64url SHA-256 of its verifier", async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("trades its own code with its own verifier, and keeps the session only when the nonce is its own", async () => {
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?code=c0de&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: true });
    expect(stored).toEqual(["body.sig"]);
    answer = () => ({ type: "success", url: `appscheme://x-auth?code=c0de&state=${"ab".repeat(16)}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "state" });
    expect(stored).toEqual(["body.sig"]);
    expect(exchanges).toHaveLength(1);
  });

  it("a session in the URL is never taken, and a refused exchange keeps nothing", async () => {
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?session=evil.sig&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "server" });
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?code=wrong&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "token" });
    expect(stored).toEqual([]);
  });

  it("maps the web's failure words and nothing else", async () => {
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?error=denied&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "denied" });
    answer = (state) => ({ type: "success", url: `appscheme://x-auth?error=%3Cscript%3E&state=${state}` });
    expect(await signInWithX()).toEqual({ ok: false, reason: "server" });
  });
});
