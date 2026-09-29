/**
 * `POST /internal/*`: the web → ops calls that exercise venue authority (plan §3). Each request carries the HMAC of
 * `@agari/markets/ops/canton` `signInternalRequest` under `OPS_INTERNAL_SECRET`; without the secret configured every
 * internal route answers 503, so a misconfigured deploy can never issue quotes to anyone. No CORS: a browser never
 * calls these, only the web's route handlers.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { INTERNAL_SIG_HEADER, INTERNAL_TS_HEADER, MIN_SECRET_LENGTH, verifyInternalRequest } from "@agari/markets/ops/canton";
import { jsonText } from "./health";

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
  if (!internal || !handler) return json(404, { error: "not found" });
  if (!internal.secret || internal.secret.length < MIN_SECRET_LENGTH) return json(503, { error: "internal routes are closed: OPS_INTERNAL_SECRET is not set" });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    return json(413, { error: "body too large" });
  }
  const auth = verifyInternalRequest(internal.secret, "POST", path, raw, { ts: header(req, INTERNAL_TS_HEADER), sig: header(req, INTERNAL_SIG_HEADER) });
  if (!auth.ok) return json(401, { error: `unauthenticated (${auth.reason})` });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "body is not JSON" });
  }
  try {
    const out = await handler(body);
    return json(out.status, out.body);
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
}
