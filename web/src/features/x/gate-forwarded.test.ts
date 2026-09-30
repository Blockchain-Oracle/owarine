import { beforeEach, describe, expect, it, vi } from "vitest";

/** C13a: the app's forwarded X session (the `/native-auth` handoff) is read and validated exactly like the cookie. */
const jar = new Map<string, string>();
const head = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined) }),
  headers: async () => ({ get: (name: string) => head.get(name) ?? null }),
}));
vi.mock("./config.server", () => ({
  readXConfig: () => ({ configured: true, config: { consumerKey: "k", consumerSecret: "s", sessionSecret: "x".repeat(32), redirectUri: "https://h/api/x/callback" } }),
}));

const { readXGate } = await import("./gate.server");
const { signSession, X_SESSION_COOKIE, X_SESSION_HEADER } = await import("./session.server");
const SECRET = "x".repeat(32);
const token = (authorId: string, secret = SECRET) => signSession(secret, { authorId, handle: "h", t: Date.now() });

describe("X gate: cookie or the app's forwarded session", () => {
  beforeEach(() => {
    jar.clear();
    head.clear();
  });

  it("reads the forwarded header when there is no cookie", async () => {
    head.set(X_SESSION_HEADER, token("42"));
    const gate = await readXGate("https://h");
    expect(gate.configured && gate.session?.authorId).toBe("42");
  });

  it("prefers the cookie, and refuses a forged header", async () => {
    jar.set(X_SESSION_COOKIE, token("1"));
    head.set(X_SESSION_HEADER, token("2"));
    const gate = await readXGate("https://h");
    expect(gate.configured && gate.session?.authorId).toBe("1");
    jar.clear();
    head.set(X_SESSION_HEADER, token("3", "y".repeat(32)));
    const forged = await readXGate("https://h");
    expect(forged.configured && forged.session).toBeNull();
  });
});
