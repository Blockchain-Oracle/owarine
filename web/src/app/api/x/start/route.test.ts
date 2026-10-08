import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauth = vi.hoisted(() => ({
  requestToken: vi.fn(async () => ({ oauthToken: "tok", oauthTokenSecret: "sec" })),
  authenticateUrl: (token: string) => `https://api.x.com/oauth/authenticate?oauth_token=${token}`,
}));
vi.mock("@/features/x/oauth.server", () => oauth);

const { GET } = await import("./route");

const ENV = {
  X_API_KEY: "key",
  X_API_KEY_SECRET: "secret",
  X_SESSION_SECRET: "s".repeat(64),
  X_REDIRECT_URI: "https://owarine.com/api/x/callback",
  TRUSTED_PROXY: "cloudflare",
};

/** What the container sees behind Cloudflare → Traefik: plain http, the public host, and maybe the proxy's headers. */
const behindProxy = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });

describe("GET /api/x/start (the 2026-09-24 redirect loop)", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    oauth.requestToken.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("goes to X when TLS ends at the proxy and no forwarded proto arrives", async () => {
    const res = await GET(behindProxy("http://owarine.com/api/x/start?return=/trade-from-x"));
    expect(res.headers.get("location")).toBe("https://api.x.com/oauth/authenticate?oauth_token=tok");
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("goes to X when the proxy forwards https", async () => {
    const res = await GET(behindProxy("http://owarine.com/api/x/start", { "x-forwarded-proto": "https" }));
    expect(res.headers.get("location")).toMatch(/^https:\/\/api\.x\.com\//);
  });

  it("goes home with the reason when X cannot be reached, never to a raw error body (C9e)", async () => {
    oauth.requestToken.mockResolvedValueOnce({ error: "TimeoutError", status: 0 } as never);
    const res = await GET(behindProxy("http://owarine.com/api/x/start?return=/claim"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://owarine.com/claim?x=err&x_reason=server");
  });

  it("still moves a browser on another host to the callback's host, once", async () => {
    const res = await GET(behindProxy("https://www.owarine.com/api/x/start?return=/trade-from-x"));
    expect(res.headers.get("location")).toBe("https://owarine.com/api/x/start?return=%2Ftrade-from-x");
    expect(oauth.requestToken).not.toHaveBeenCalled();
  });
});

describe("GET /api/x/start on the OAuth 2.0 client (8 Oct)", () => {
  const OAUTH2_ENV = {
    X_OAUTH2_CLIENT_ID: "client-id",
    X_OAUTH2_CLIENT_SECRET: "client-secret",
    X_SESSION_SECRET: "s".repeat(64),
    X_REDIRECT_URI: "https://owarine.xyz/api/x/callback",
    TRUSTED_PROXY: "cloudflare",
  };
  beforeEach(() => {
    vi.stubEnv("X_API_KEY", "");
    vi.stubEnv("X_API_KEY_SECRET", "");
    for (const [k, v] of Object.entries(OAUTH2_ENV)) vi.stubEnv(k, v);
    oauth.requestToken.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("goes to X's authorize page with PKCE and keeps the state and verifier in httpOnly cookies", async () => {
    const res = await GET(behindProxy("https://owarine.xyz/api/x/start?return=/portfolio"));
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("https://owarine.xyz/api/x/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("scope")).toBe("tweet.read users.read");
    const cookies = res.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`x_st=${location.searchParams.get("state")}`);
    expect(cookies).toMatch(/x_cv=[A-Za-z0-9_-]{43}/);
    expect(cookies).toContain("HttpOnly");
    expect(oauth.requestToken).not.toHaveBeenCalled();
  });

  it("prefers the OAuth 1.0a pair when both are set", async () => {
    vi.stubEnv("X_API_KEY", "key");
    vi.stubEnv("X_API_KEY_SECRET", "secret");
    const res = await GET(behindProxy("https://owarine.xyz/api/x/start"));
    expect(res.headers.get("location")).toBe("https://api.x.com/oauth/authenticate?oauth_token=tok");
  });
});
