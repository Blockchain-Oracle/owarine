/**
 * `POST /internal/*`: the web → ops calls that exercise venue authority (plan §3). Each request carries the web's
 * `x-agari-ops-ts` / `x-agari-ops-nonce` / `x-agari-ops-sig` headers, checked with `@agari/markets/server`
 * `verifyOpsSignature` under `OPS_INTERNAL_SECRET` (30 s skew), so both sides compute the MAC one way; a nonce is taken
 * once (C4d L4), so a captured call cannot be replayed even inside its 30 seconds. The season admin's routes
 * (`OPS_ADMIN_PATHS`) take `OPS_ADMIN_SECRET` instead and are closed without it. Without the secret every internal route
 * answers 503, so a misconfigured deploy can never issue quotes to anyone. No CORS: a browser never calls these, only
 * the web's route handlers; they should not be routed publicly at all (runbook `coolify-deploy.md`). Failures answer
 * `{ diagnosis }`, which the web's ops client reads; a handler's crash answers a generic 500 with a reference, and its
 * text goes to the log only.
 */
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { diagnosis } from "@agari/core/types";
import { OPS_ADMIN_PATHS, OPS_NONCE_HEADER, OPS_SIG_HEADER, OPS_SKEW_MS, OPS_TS_HEADER, verifyOpsSignature } from "@agari/markets/server";
import { jsonText } from "./health";

/** A secret shorter than this is treated as unset. */
export const MIN_SECRET_LENGTH = 32;

export type InternalHandler = (body: unknown) => Promise<{ status: number; body: unknown }>;

export interface InternalRoutes {
  /** `OPS_INTERNAL_SECRET`; null or short = every internal route is closed. */
  secret: string | null;
  /** `OPS_ADMIN_SECRET`, the season admin's own; null or short = the admin routes are closed (C4d L4). */
  adminSecret?: string | null;
  /** Path → handler, e.g. `/internal/quotes`, `/internal/seats/fund`. */
  routes: Record<string, InternalHandler>;
}

const MAX_BODY_BYTES = 16_384;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const header = (req: IncomingMessage, name: string) => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

/** Nonces taken, until their call could no longer be fresh (twice the skew: a timestamp may sit either side of now). */
const seen = new Map<string, number>();
const KEEP_MS = 2 * OPS_SKEW_MS;

/** True the first time a (verified) nonce is offered; false for a replay. Exported for the unit test. */
export function takeOpsNonce(nonce: string, nowMs: number = Date.now()): boolean {
  // Fixed lifetime, so the map is in expiry order: stop at the first live entry.
  for (const [n, until] of seen) {
    if (until > nowMs) break;
    seen.delete(n);
  }
  if (seen.has(nonce) || seen.size >= 100_000) return false;
  seen.set(nonce, nowMs + KEEP_MS);
  return true;
}

export async function handleInternal(req: IncomingMessage, res: ServerResponse, path: string, internal: InternalRoutes | null | undefined): Promise<void> {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(jsonText(body));
  };
  const handler = internal?.routes[path];
  if (!internal || !handler) return json(404, { diagnosis: diagnosis("not-deployed", `no ${path} in this ops process`) });
  const admin = OPS_ADMIN_PATHS.has(path);
  const secret = admin ? (internal.adminSecret ?? null) : internal.secret;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return json(503, { diagnosis: diagnosis("not-deployed", `internal routes are closed: ${admin ? "OPS_ADMIN_SECRET" : "OPS_INTERNAL_SECRET"} is not set`) });
  }
  if (req.method !== "POST") return json(405, { diagnosis: diagnosis("unknown", "POST only") });
  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    return json(413, { diagnosis: diagnosis("unknown", "body too large") });
  }
  const nonce = header(req, OPS_NONCE_HEADER) ?? null;
  const ok = verifyOpsSignature(secret, { ts: header(req, OPS_TS_HEADER) ?? null, nonce, sig: header(req, OPS_SIG_HEADER) ?? null, method: "POST", path, body: raw });
  if (!ok) return json(401, { diagnosis: diagnosis("unknown", "unauthenticated ops call (bad or stale signature)") });
  if (!takeOpsNonce(`${path}.${nonce}`)) return json(401, { diagnosis: diagnosis("unknown", "unauthenticated ops call (replayed)") });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { diagnosis: diagnosis("unknown", "body is not JSON") });
  }
  try {
    const out = await handler(body);
    return json(out.status, out.body);
  } catch (error) {
    const ref = randomBytes(4).toString("hex");
    console.error(`[ops] ${path} failed (ref ${ref}): ${error instanceof Error ? error.message : String(error)}`);
    return json(500, { diagnosis: diagnosis("unknown", `ops could not complete this call (ref ${ref})`) });
  }
}
