import { describe, expect, it, vi } from "vitest";
import { passwordGrant, redactSecrets } from "./auth";
import { LedgerError } from "./errors";

const CFG = {
  tokenUrl: "https://kc.example/realms/r/protocol/openid-connect/token",
  clientId: "web-app",
  username: "abu@example.com",
  password: "hunter2-secret",
  scope: "openid daml_ledger_api",
};

function jwt(payload: object): string {
  return `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
}

function tokenResponse(token: string, expiresIn = 10_800): Response {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn, refresh_token: "RT-never-stored" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("passwordGrant", () => {
  it("single-flights concurrent callers into one grant", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetch = vi.fn(async () => {
      await gate;
      return tokenResponse("T1");
    });
    const src = passwordGrant(CFG, { fetch: fetch as unknown as typeof globalThis.fetch });
    const all = Promise.all(Array.from({ length: 20 }, () => src.token()));
    release();
    expect(await all).toEqual(Array(20).fill("T1"));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const form = new URLSearchParams(String(init.body));
    expect(form.get("grant_type")).toBe("password");
    expect(form.get("scope")).toBe("openid daml_ledger_api");
  });

  it("re-grants at 80% of expires_in, not before", async () => {
    let t = 0;
    let n = 0;
    const fetch = vi.fn(async () => tokenResponse(`T${++n}`, 100));
    const src = passwordGrant(CFG, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => t });
    const seen: string[] = [];
    src.onRegrant((tok) => seen.push(tok));
    expect(await src.token()).toBe("T1");
    expect(src.refreshAt()).toBe(80_000);
    t = 79_999;
    expect(await src.token()).toBe("T1");
    t = 80_000;
    expect(await src.token()).toBe("T2");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(["T1", "T2"]);
  });

  it("keeps the old token while it is valid if a re-grant fails, then backs off", async () => {
    let t = 0;
    let fail = false;
    const fetch = vi.fn(async () => (fail ? new Response("down", { status: 503 }) : tokenResponse("T1", 100)));
    const src = passwordGrant({ ...CFG, retryGapMs: 5_000 }, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => t });
    await src.token();
    fail = true;
    t = 85_000;
    expect(await src.token()).toBe("T1");
    expect(await src.token()).toBe("T1"); // inside the retry gap: no new attempt
    expect(fetch).toHaveBeenCalledTimes(2);
    t = 100_000; // expired
    await expect(src.token()).rejects.toBeInstanceOf(LedgerError);
  });

  it("invalidate(stale) drops only that token, so a 401 storm causes one grant", async () => {
    let n = 0;
    const fetch = vi.fn(async () => tokenResponse(`T${++n}`));
    const src = passwordGrant(CFG, { fetch: fetch as unknown as typeof globalThis.fetch });
    const stale = await src.token();
    for (let i = 0; i < 10; i++) src.invalidate(stale);
    const next = await Promise.all([src.token(), src.token(), src.token()]);
    src.invalidate(stale); // stale again: current token is T2, untouched
    expect(next).toEqual(["T2", "T2", "T2"]);
    expect(await src.token()).toBe("T2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("redacts credentials from grant errors", async () => {
    const body = JSON.stringify({ error: "invalid_grant", error_description: `bad password hunter2-secret for abu@example.com` });
    const fetch = vi.fn(async () => new Response(body, { status: 401, headers: { "content-type": "application/json" } }));
    const src = passwordGrant(CFG, { fetch: fetch as unknown as typeof globalThis.fetch });
    const err = (await src.token().catch((e: unknown) => e)) as LedgerError;
    expect(err.kind).toBe("auth");
    expect(err.message).toContain("invalid_grant");
    expect(err.message).not.toContain("hunter2-secret");
    expect(err.message).not.toContain("abu@example.com");
  });

  it("checks the audience when configured", async () => {
    const fetch = vi.fn(async () => tokenResponse(jwt({ aud: ["https://other"] })));
    const src = passwordGrant({ ...CFG, audience: "https://hackcanton-01.devnet.naas.noders.services" }, {
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await expect(src.token()).rejects.toThrow(/aud/);
  });

  it("redactSecrets also catches URL-encoded forms", () => {
    expect(redactSecrets("u=abu%40example.com", ["abu@example.com"])).toBe("u=[redacted]");
  });
});
