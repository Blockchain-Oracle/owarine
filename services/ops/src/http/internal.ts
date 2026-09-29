/**
 * `POST /internal/*`: the web → ops calls that exercise venue authority (plan §3). Each request carries the web's
 * `x-agari-ops-ts` / `x-agari-ops-sig` headers, checked with `@agari/markets/server` `verifyOpsSignature` under
 * `OPS_INTERNAL_SECRET` (30 s skew), so both sides compute the MAC one way. Without the secret every internal route
 * answers 503, so a misconfigured deploy can never issue quotes to anyone. No CORS: a browser never calls these, only
 * the web's route handlers. Failures answer `{ diagnosis }`, which the web's ops client reads.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { diagnosis } from "@agari/core/types";
import { OPS_SIG_HEADER, OPS_TS_HEADER, verifyOpsSignature } from "@agari/markets/server";
import { jsonText } from "./health";

/** A secret shorter than this is treated as unset. */
export const MIN_SECRET_LENGTH = 32;

export type InternalHandler = (body: unknown) => Promise<{ status: number; body: unknown }>;

export interface InternalRoutes {
  /** `OPS_INTERNAL_SECRET`; null or short = every internal route is closed. */
  secret: string | null;
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

export async function handleInternal(req: IncomingMessage, res: ServerResponse, path: string, internal: InternalRoutes | null | undefined): Promise<void> {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(jsonText(body));
  };
  const handler = internal?.routes[path];
  if (!internal || !handler) return json(404, { diagnosis: diagnosis("not-deployed", `no ${path} in this ops process`) });
  if (!internal.secret || internal.secret.length < MIN_SECRET_LENGTH) return json(503, { diagnosis: diagnosis("not-deployed", "internal routes are closed: OPS_INTERNAL_SECRET is not set") });
  if (req.method !== "POST") return json(405, { diagnosis: diagnosis("unknown", "POST only") });
  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    return json(413, { diagnosis: diagnosis("unknown", "body too large") });
  }
  const ok = verifyOpsSignature(internal.secret, { ts: header(req, OPS_TS_HEADER) ?? null, sig: header(req, OPS_SIG_HEADER) ?? null, method: "POST", path, body: raw });
  if (!ok) return json(401, { diagnosis: diagnosis("unknown", "unauthenticated ops call (bad or stale signature)") });
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
    return json(500, { diagnosis: diagnosis("unknown", error instanceof Error ? error.message : String(error)) });
  }
}
