/**
 * The web tier's only way to ask for venue authority (plan §3): an HMAC-signed call to ops' internal HTTP server.
 * Quote issuance (`POST /internal/quotes`) and seat funding (`POST /internal/seats/fund`) run in ops as the venue; the
 * route handlers never act as the venue. Both sides import this module, so the signature is computed one way.
 *
 * Signature: `x-agari-ops-sig: v1=<hex HMAC-SHA256(secret, "<ts>.<METHOD>.<path>.<body>")>` with `x-agari-ops-ts: <ms>`;
 * ops rejects a timestamp more than 30 s away from its clock, so a captured call cannot be replayed later.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { diagnosis, diagnosisSchema, type Diagnosis } from "@agari/core/types";
import { z } from "zod";
import { quoteReplyWire, toWire, type QuoteReply, type QuoteRequest } from "../provider/ledger-wire";

export const OPS_TS_HEADER = "x-agari-ops-ts";
export const OPS_SIG_HEADER = "x-agari-ops-sig";
export const OPS_SKEW_MS = 30_000;
export const OPS_QUOTES_PATH = "/internal/quotes";
export const OPS_SEAT_FUND_PATH = "/internal/seats/fund";

export function opsSignature(secret: string, ts: number, method: string, path: string, body: string): string {
  return `v1=${createHmac("sha256", secret).update(`${ts}.${method.toUpperCase()}.${path}.${body}`).digest("hex")}`;
}

/** For ops' handler: true only for a fresh timestamp and a matching MAC (constant-time). */
export function verifyOpsSignature(secret: string, o: { ts: string | null; sig: string | null; method: string; path: string; body: string; nowMs?: number }): boolean {
  if (!o.ts || !o.sig || !/^\d{1,16}$/.test(o.ts)) return false;
  const ts = Number(o.ts);
  if (Math.abs((o.nowMs ?? Date.now()) - ts) > OPS_SKEW_MS) return false;
  const expected = Buffer.from(opsSignature(secret, ts, o.method, o.path, o.body));
  const given = Buffer.from(o.sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** What the web sends ops for a quote: the request as the seat confirmed it, plus WHO, taken from the lease only. */
export interface OpsQuoteRequest extends QuoteRequest {
  party: string;
  leaseId: string;
}

export const seatFundReplyWire = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("funded"), amountBase: z.string().regex(/^\d+$/) }),
  /** Already funded for this lease: nothing new was credited. */
  z.object({ kind: z.literal("already") }),
  z.object({ kind: z.literal("refused"), diagnosis: diagnosisSchema }),
]);
export type SeatFundReply = z.output<typeof seatFundReplyWire>;

export interface OpsClientConfig {
  baseUrl: string;
  secret: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export type OpsClient = ReturnType<typeof createOpsClient>;

const rpcDown = (technical: string): Diagnosis => diagnosis("rpc-down", technical);

export function createOpsClient(cfg: OpsClientConfig) {
  const doFetch = cfg.fetch ?? globalThis.fetch;
  const now = cfg.now ?? Date.now;
  const base = cfg.baseUrl.replace(/\/$/, "");

  async function post(path: string, payload: unknown): Promise<{ ok: true; json: unknown } | { ok: false; diagnosis: Diagnosis }> {
    const body = JSON.stringify(toWire(payload));
    const ts = now();
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", [OPS_TS_HEADER]: String(ts), [OPS_SIG_HEADER]: opsSignature(cfg.secret, ts, "POST", path, body) },
        body,
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000),
        cache: "no-store",
      } as RequestInit);
    } catch (error) {
      return { ok: false, diagnosis: rpcDown(`ops unreachable at ${path}: ${error instanceof Error ? error.message : String(error)}`) };
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // handled below
    }
    if (!res.ok) {
      const parsed = z.object({ diagnosis: diagnosisSchema }).safeParse(json);
      return { ok: false, diagnosis: parsed.success ? parsed.data.diagnosis : rpcDown(`ops ${path} → ${res.status}: ${text.slice(0, 200)}`) };
    }
    return { ok: true, json };
  }

  return {
    /** A firm quote, a requote, or a refusal; an unreachable ops is `rpc-down`, and nothing was created. */
    async quote(request: OpsQuoteRequest): Promise<QuoteReply> {
      const r = await post(OPS_QUOTES_PATH, request);
      if (!r.ok) return { kind: "refused", diagnosis: r.diagnosis };
      const parsed = quoteReplyWire.safeParse(r.json);
      return parsed.success ? parsed.data : { kind: "refused", diagnosis: rpcDown(`ops quote reply did not parse: ${parsed.error.message.slice(0, 200)}`) };
    },
    async fundSeat(request: { party: string; leaseId: string; address: string }): Promise<SeatFundReply> {
      const r = await post(OPS_SEAT_FUND_PATH, request);
      if (!r.ok) return { kind: "refused", diagnosis: r.diagnosis };
      const parsed = seatFundReplyWire.safeParse(r.json);
      return parsed.success ? parsed.data : { kind: "refused", diagnosis: rpcDown("ops seat-fund reply did not parse") };
    },
  };
}
