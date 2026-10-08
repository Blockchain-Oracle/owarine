import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.values.has(name) ? { value: jar.values.get(name) } : undefined) }) }));

const oauth2 = vi.hoisted(() => ({
  exchangeCode: vi.fn(async () => ({ accessToken: "at" }) as { accessToken: string } | { error: string; status: number }),
  readMe: vi.fn(async () => ({ id: "42", username: "owarine_app" }) as { id: string; username: string | null } | { error: string; status: number }),
}));
vi.mock("@/features/x/oauth2.server", () => oauth2);

const { GET } = await import("./route");
const { readSession } = await import("@/features/x/session.server");

const SECRET = "s".repeat(64);
const ENV = {
  X_API_KEY: "",
  X_API_KEY_SECRET: "",
  X_OAUTH2_CLIENT_ID: "client-id",
  X_OAUTH2_CLIENT_SECRET: "client-secret",
  X_SESSION_SECRET: SECRET,
  X_REDIRECT_URI: "https://owarine.xyz/api/x/callback",
  TRUSTED_PROXY: "cloudflare",
};
const callback = (query: string) => GET(new NextRequest(`https://owarine.xyz/api/x/callback?${query}`));

describe("GET /api/x/callback on the OAuth 2.0 client (8 Oct)", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    jar.values = new Map([["x_st", "the-state"], ["x_cv", "v".repeat(43)], ["x_ret", "/portfolio"]]);
    oauth2.exchangeCode.mockClear();
    oauth2.readMe.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("signs the session with the account X names and clears the hand-off cookies", async () => {
    const res = await callback("code=c0de&state=the-state");
    expect(res.headers.get("location")).toBe("https://owarine.xyz/portfolio?x=1");
    expect(oauth2.exchangeCode).toHaveBeenCalledWith(expect.objectContaining({ kind: "oauth2", clientId: "client-id" }), "c0de", "v".repeat(43), "https://owarine.xyz/api/x/callback");
    const session = res.cookies.get("x_sess")?.value;
    expect(readSession(SECRET, session)).toMatchObject({ authorId: "42", handle: "owarine_app" });
    for (const name of ["x_st", "x_cv", "x_ret"]) expect(res.cookies.get(name)?.value).toBe("");
  });

  it("refuses a state this browser did not start with, before any exchange", async () => {
    const res = await callback("code=c0de&state=someone-else");
    expect(res.headers.get("location")).toBe("https://owarine.xyz/portfolio?x=err&x_reason=state");
    expect(oauth2.exchangeCode).not.toHaveBeenCalled();
  });

  it("says the person cancelled when X answers with an error", async () => {
    const res = await callback("error=access_denied&state=the-state");
    expect(res.headers.get("location")).toBe("https://owarine.xyz/portfolio?x=err&x_reason=denied");
  });

  it("carries X's own error code from the token exchange", async () => {
    oauth2.exchangeCode.mockResolvedValueOnce({ error: "invalid_grant", status: 400 });
    const res = await callback("code=c0de&state=the-state");
    expect(res.headers.get("location")).toBe("https://owarine.xyz/portfolio?x=err&x_reason=token_invalid_grant");
  });

  it("names the profile read when the plan refuses /2/users/me, and sets no session", async () => {
    oauth2.readMe.mockResolvedValueOnce({ error: "status 403", status: 403 });
    const res = await callback("code=c0de&state=the-state");
    expect(res.headers.get("location")).toBe("https://owarine.xyz/portfolio?x=err&x_reason=profile");
    expect(res.cookies.get("x_sess")).toBeUndefined();
  });
});
