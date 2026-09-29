/**
 * The web tier's only way to ask for venue authority (plan §3): an HMAC-signed call to ops' internal HTTP server.
 * Quote issuance (`POST /internal/quotes`), buy-back (exit) quotes (`POST /internal/exit-quotes`) and seat funding (`POST /internal/seats/fund`) run in ops as the venue; the
 * route handlers never act as the venue. Both sides import this module, so the signature is computed one way.
 *
 * Signature: `x-agari-ops-sig: v1=<hex HMAC-SHA256(secret, "<ts>.<METHOD>.<path>.<body>")>` with `x-agari-ops-ts: <ms>`;
 * ops rejects a timestamp more than 30 s away from its clock, so a captured call cannot be replayed later.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { diagnosis, diagnosisSchema, type Diagnosis } from "@agari/core/types";
import { z } from "zod";
import { ladderLatestWire, parseLadder } from "../runtime/ladder";
import { ladderMid2 } from "./map";
import { exitQuoteReplyWire, quoteReplyWire, toWire, type ExitQuoteReply, type ExitQuoteRequest, type QuoteReply, type QuoteRequest } from "../provider/ledger-wire";
import {
  boostTicketReplyWire, earnReplyWire, parlayTicketReplyWire, rangeTicketReplyWire, ticketStateReplyWire,
  type BoostTicketReply, type EarnReply, type ParlayTicketReply, type RangeTicketReply, type TicketStateReply,
} from "../provider/ticket-wire";

export const OPS_TS_HEADER = "x-agari-ops-ts";
export const OPS_SIG_HEADER = "x-agari-ops-sig";
export const OPS_SKEW_MS = 30_000;
export const OPS_QUOTES_PATH = "/internal/quotes";
export const OPS_SEAT_FUND_PATH = "/internal/seats/fund";
export const OPS_EXIT_QUOTES_PATH = "/internal/exit-quotes";
/** The ticket desk (C8c): `range`, `parlay`, `boost`, `earn` and `state` under this prefix. */
export const OPS_TICKETS_PREFIX = "/internal/tickets/";

const TICKET_REPLIES = { range: rangeTicketReplyWire, parlay: parlayTicketReplyWire, boost: boostTicketReplyWire, earn: earnReplyWire } as const;
export type TicketDeskProduct = keyof typeof TICKET_REPLIES;
export interface TicketDeskReplies {
  range: RangeTicketReply;
  parlay: ParlayTicketReply;
  boost: BoostTicketReply;
  earn: EarnReply;
}

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

/** What the web sends ops for a sale: the exit as the seat confirmed it, plus WHO, taken from the lease only. */
export interface OpsExitQuoteRequest extends ExitQuoteRequest {
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

  let marks: { atMs: number; value: Promise<ReadonlyMap<string, number>> } | null = null;
  let fair: { atMs: number; value: Promise<ReadonlyMap<string, number>> } | null = null;
  async function readFair(): Promise<ReadonlyMap<string, number>> {
    const res = await doFetch(`${base}/ladders/latest`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(cfg.timeoutMs ?? 3_000), cache: "no-store" } as RequestInit);
    if (!res.ok) throw new Error(`ladders ${res.status}`);
    const parsed = ladderLatestWire.parse(await res.json());
    const out = new Map<string, number>();
    for (const raw of parsed.ladders) {
      const l = parseLadder(raw);
      if (l && l.state === "quoting" && typeof l.fairTicks === "number") out.set(l.termsCid, l.fairTicks);
    }
    return out;
  }
  async function readMarks(): Promise<ReadonlyMap<string, number>> {
    const res = await doFetch(`${base}/ladders/latest`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(cfg.timeoutMs ?? 3_000), cache: "no-store" } as RequestInit);
    if (!res.ok) throw new Error(`ladders ${res.status}`);
    const parsed = ladderLatestWire.parse(await res.json());
    const out = new Map<string, number>();
    for (const raw of parsed.ladders) {
      const l = parseLadder(raw);
      const mid2 = l ? ladderMid2(l) : null;
      if (l && mid2 !== null) out.set(l.termsCid, mid2);
    }
    return out;
  }

  return {
    /** The venue ladder's mids by terms id (the public `/ladders/latest`, no HMAC), cached 1 s: the positions' live mark. */
    ladderMarks(): Promise<ReadonlyMap<string, number>> {
      if (marks && now() - marks.atMs < 1_000) return marks.value;
      const entry = { atMs: now(), value: readMarks() };
      marks = entry;
      entry.value.catch(() => marks === entry && (marks = null));
      return entry.value;
    },
    /** A firm quote, a requote, or a refusal; an unreachable ops is `rpc-down`, and nothing was created. */
    async quote(request: OpsQuoteRequest): Promise<QuoteReply> {
      const r = await post(OPS_QUOTES_PATH, request);
      if (!r.ok) return { kind: "refused", diagnosis: r.diagnosis };
      const parsed = quoteReplyWire.safeParse(r.json);
      return parsed.success ? parsed.data : { kind: "refused", diagnosis: rpcDown(`ops quote reply did not parse: ${parsed.error.message.slice(0, 200)}`) };
    },
    /** A firm buy-back of the seat's held side, a requote below the confirmed floor, or a refusal (C7a). */
    async exitQuote(request: OpsExitQuoteRequest): Promise<ExitQuoteReply> {
      const r = await post(OPS_EXIT_QUOTES_PATH, request);
      if (!r.ok) return { kind: "refused", diagnosis: r.diagnosis };
      const parsed = exitQuoteReplyWire.safeParse(r.json);
      return parsed.success ? parsed.data : { kind: "refused", diagnosis: rpcDown(`ops exit quote reply did not parse: ${parsed.error.message.slice(0, 200)}`) };
    },
    /** The venue ladder's fair YES ticks by terms id (public `/ladders/latest`), cached 1 s: a boost's live mark. */
    fairTicks(): Promise<ReadonlyMap<string, number>> {
      if (fair && now() - fair.atMs < 1_000) return fair.value;
      const entry = { atMs: now(), value: readFair() };
      fair = entry;
      entry.value.catch(() => fair === entry && (fair = null));
      return entry.value;
    },
    /** A ticket preview, a firm ticket or liquidity quote, a requote, or a refusal (C8c). WHO comes from the lease only. */
    async ticket<P extends TicketDeskProduct>(product: P, request: Record<string, unknown> & { party?: string; leaseId?: string }): Promise<TicketDeskReplies[P]> {
      const r = await post(`${OPS_TICKETS_PREFIX}${product}`, request);
      if (!r.ok) return { kind: "refused", diagnosis: r.diagnosis } as TicketDeskReplies[P];
      const parsed = TICKET_REPLIES[product].safeParse(r.json);
      return (parsed.success ? parsed.data : { kind: "refused", diagnosis: rpcDown(`ops ${product} reply did not parse: ${parsed.error.message.slice(0, 200)}`) }) as TicketDeskReplies[P];
    },
    /** The three ticket reserves as ops reads them; null when ops has no ticket desk or is unreachable. */
    async ticketState(): Promise<{ ok: true; value: TicketStateReply } | { ok: false; diagnosis: Diagnosis }> {
      const r = await post(`${OPS_TICKETS_PREFIX}state`, {});
      if (!r.ok) return r;
      const parsed = ticketStateReplyWire.safeParse(r.json);
      return parsed.success ? { ok: true, value: parsed.data } : { ok: false, diagnosis: rpcDown(`ops ticket state did not parse: ${parsed.error.message.slice(0, 200)}`) };
    },
    async fundSeat(request: { party: string; leaseId: string; address: string }): Promise<SeatFundReply> {
      const r = await post(OPS_SEAT_FUND_PATH, request);
      if (!r.ok) return { kind: "refused", diagnosis: r.diagnosis };
      const parsed = seatFundReplyWire.safeParse(r.json);
      return parsed.success ? parsed.data : { kind: "refused", diagnosis: rpcDown("ops seat-fund reply did not parse") };
    },
  };
}
