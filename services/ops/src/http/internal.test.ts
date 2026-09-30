import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { adminSignature } from "@agari/markets/games";
import { OPS_NONCE_HEADER, OPS_SIG_HEADER, OPS_TS_HEADER, opsNonce, opsSignature } from "@agari/markets/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleInternal, type InternalRoutes } from "./internal";

/**
 * C4d L4: ops' `/internal/*` took a signed call again and again inside its 30 s window, answered a handler's crash with
 * the error's own text, and signed the season admin's payout with the web's secret.
 */
const WEB = "w".repeat(40);
const ADMIN = "a".repeat(40);
const routes: InternalRoutes = {
  secret: WEB,
  adminSecret: ADMIN,
  routes: {
    "/internal/quotes": async () => ({ status: 200, body: { kind: "quote" } }),
    "/internal/seats/fund": async () => {
      throw new Error("connection to db.internal:5432 refused for party seat-7::1220f00d");
    },
    "/internal/games/season/distribute": async () => ({ status: 200, body: { kind: "paid" } }),
  },
};
let server: Server;
let base = "";
let current: InternalRoutes = routes;
beforeAll(async () => {
  server = createServer((req, res) => void handleInternal(req, res, req.url ?? "", current));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const signed = (path: string, secret = WEB, body = "{}") => {
  const ts = Date.now();
  const nonce = opsNonce();
  return { method: "POST", headers: { [OPS_TS_HEADER]: String(ts), [OPS_NONCE_HEADER]: nonce, [OPS_SIG_HEADER]: opsSignature(secret, ts, nonce, "POST", path, body) }, body };
};

describe("ops /internal/* (C4d L4)", () => {
  it("takes a signed call once: the same call again is a replay", async () => {
    const call = signed("/internal/quotes");
    expect((await fetch(`${base}/internal/quotes`, call)).status).toBe(200);
    const again = await fetch(`${base}/internal/quotes`, call);
    expect(again.status).toBe(401);
    expect(JSON.stringify(await again.json())).toContain("replayed");
    expect((await fetch(`${base}/internal/quotes`, signed("/internal/quotes"))).status).toBe(200);
  });

  it("a handler's crash answers a generic 500 with a reference, never its text", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await fetch(`${base}/internal/seats/fund`, signed("/internal/seats/fund"));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("db.internal");
    expect(text).not.toContain("1220f00d");
    expect(text).toMatch(/ops could not complete this call \(ref [0-9a-f]{8}\)/);
    expect(String(errors.mock.calls[0]?.[0])).toContain("db.internal");
    errors.mockRestore();
  });

  it("the season admin's routes take the admin's own secret, never the web's, and close without it", async () => {
    const path = "/internal/games/season/distribute";
    expect((await fetch(`${base}${path}`, signed(path, WEB))).status).toBe(401);
    expect((await fetch(`${base}${path}`, signed(path, ADMIN))).status).toBe(200);
    // The admin client's own signer (browser-safe HMAC) computes the same v2 MAC ops checks.
    const ts = Date.now();
    const nonce = opsNonce();
    expect((await fetch(`${base}${path}`, { method: "POST", headers: { [OPS_TS_HEADER]: String(ts), [OPS_NONCE_HEADER]: nonce, [OPS_SIG_HEADER]: adminSignature(ADMIN, ts, nonce, path, "{}") }, body: "{}" })).status).toBe(200);
    // The admin secret opens nothing else.
    expect((await fetch(`${base}/internal/quotes`, signed("/internal/quotes", ADMIN))).status).toBe(401);
    current = { ...routes, adminSecret: null };
    expect((await fetch(`${base}${path}`, signed(path, ADMIN))).status).toBe(503);
    current = routes;
  });
});
