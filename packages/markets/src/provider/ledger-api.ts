/**
 * The client half's one door to the ledger: our own route handlers (plan §1), same-origin in the browser (the seat
 * cookie rides along), an absolute URL on the phone (`EXPO_PUBLIC_SITE_URL`), which proves the seat with the signed
 * seat header instead. No ledger credential, party id or ledger URL ever appears here.
 *
 * The seat READ header (`x-agari-seat-read`, `@agari/core/auth`) is signed by the registered seat key once and reused
 * for four of its five minutes, so a screen's reads cost no extra signatures; the server takes it for reads only. Every
 * write (any method but GET) is signed on its own instead (C4d M2b): the WRITE proof names the method, the path with
 * its query, the SHA-256 of the exact body bytes sent and a fresh nonce, and the server takes it once within 30 s.
 * `x-agari-seat: 1` is the custom header the server requires on cookie-authenticated writes (with the Origin check),
 * which a cross-site form cannot send.
 */
import {
  bodySha256, formatSeatReadHeader, formatSeatWriteHeader, messageBytes, SEAT_READ_HEADER, SEAT_READ_TTL_MS, SEAT_WRITE_HEADER, seatReadText, seatWriteText,
} from "@agari/core/auth";
import { diagnosis, diagnosisSchema, encodeBase58, type Address, type Diagnosis, type Signature } from "@agari/core/types";
import { z } from "zod";
import { peekClient } from "../runtime/read-runtime";
import { toWire } from "./ledger-wire";

export const SEAT_CSRF_HEADER = "x-agari-seat";

export type LedgerCallResult<T> = { ok: true; value: T } | { ok: false; diagnosis: Diagnosis; status: number | null };

interface RegisteredSeat {
  address: Address;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

let seat: RegisteredSeat | null = null;
let header: { address: Address; issuedAtMs: number; value: Promise<string> } | null = null;
/** Re-sign a minute before the server's five-minute window closes. */
const HEADER_REUSE_MS = SEAT_READ_TTL_MS - 60_000;

/** The seat whose key signs the read header; the session provider registers it and clears it on dispose. */
export function registerSeatSigner(next: RegisteredSeat | null): void {
  if (next?.address === seat?.address && next?.signMessage === seat?.signMessage) return;
  seat = next;
  header = null;
}

export function registeredSeatAddress(): Address | null {
  return seat?.address ?? null;
}

/** The signed seat read header for a plain `fetch` of our own routes (C13a: the phone's inbox); null without a seat. */
export async function seatReadHeaderValue(nowMs: number = Date.now()): Promise<string | null> {
  return seatHeader(nowMs);
}

/** The one-request write proof for `method url body` (C4d M2b), signed now with a fresh nonce; null without a seat. */
export async function seatWriteHeaderValue(method: string, url: string, body: string, nowMs: number = Date.now()): Promise<string | null> {
  const current = seat;
  const cluster = peekClient()?.cluster;
  if (!current || !cluster) return null;
  const parsed = new URL(url, "http://path.invalid");
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const text = seatWriteText({ address: current.address, issuedAtMs: nowMs, nonce, method, path: `${parsed.pathname}${parsed.search}`, bodySha256: bodySha256(body) }, cluster);
  const signature = encodeBase58(await current.signMessage(messageBytes(text))) as Signature;
  return formatSeatWriteHeader({ address: current.address, issuedAtMs: nowMs, nonce, signature });
}

async function seatHeader(nowMs: number): Promise<string | null> {
  const current = seat;
  const cluster = peekClient()?.cluster;
  if (!current || !cluster) return null;
  if (header && header.address === current.address && nowMs - header.issuedAtMs < HEADER_REUSE_MS) return header.value;
  const value = current
    .signMessage(messageBytes(seatReadText(current.address, nowMs, cluster)))
    .then((sig) => formatSeatReadHeader({ address: current.address, issuedAtMs: nowMs, signature: encodeBase58(sig) as Signature }));
  const entry = { address: current.address, issuedAtMs: nowMs, value };
  header = entry;
  value.catch(() => header === entry && (header = null));
  return value;
}

/**
 * The seat proof for a POST that is not a ledger call (the duel room's credential, an arcade score: C4c): the site header
 * the cookie path needs on the web, plus the one-request write proof bound to `method url body` (C4d M2b) that the
 * phone needs, since the read header authorises reads only. Send exactly `body` as the request body.
 */
export async function seatAuthHeaders(req: { method: string; url: string; body: string }): Promise<Record<string, string>> {
  const headers: Record<string, string> = { [SEAT_CSRF_HEADER]: "1" };
  try {
    const signed = await seatWriteHeaderValue(req.method, req.url, req.body);
    if (signed) headers[SEAT_WRITE_HEADER] = signed;
  } catch {
    // No key or it would not sign: on the web the seat cookie still goes with a same-origin request.
  }
  return headers;
}

/** `/api/ledger` (or the phone's absolute URL); `root` gives its parent, where `/seat` and `/view` live. */
export function ledgerBase(root = false): string {
  const configured = (peekClient()?.ledgerApiPath ?? "/api/ledger").replace(/\/$/, "");
  const path = root ? configured.replace(/\/ledger$/, "") : configured;
  if (!path.startsWith("/")) return path;
  const pageOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (pageOrigin) return `${pageOrigin}${path}`;
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}${path}`;
}

const failureBody = z.object({ diagnosis: diagnosisSchema });

export interface LedgerRequestOptions<W extends z.ZodType> {
  method: "GET" | "POST" | "DELETE";
  body?: unknown;
  wire: W;
  /** Send the signed seat header when a seat key is registered (default true). */
  seat?: boolean;
  /** Under the API root (`/api/seat`, `/api/view`) rather than `/api/ledger`. */
  root?: boolean;
  query?: Record<string, string>;
  /** Non-2xx statuses whose body is still an answer in `wire` (`/api/seat` answers pool-full with 409). */
  okStatuses?: readonly number[];
}

/** One call to our routes. Never throws: an unreachable server is `rpc-down`, a missing seat `signer-required`. */
export async function ledgerRequest<W extends z.ZodType>(path: string, o: LedgerRequestOptions<W>): Promise<LedgerCallResult<z.output<W>>> {
  const headers: Record<string, string> = { accept: "application/json", [SEAT_CSRF_HEADER]: "1" };
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const search = o.query ? `?${new URLSearchParams(o.query)}` : "";
  const url = `${ledgerBase(o.root)}${path}${search}`;
  const body = o.body === undefined ? undefined : JSON.stringify(toWire(o.body));
  try {
    if (o.seat !== false) {
      // Reads carry the reusable read header; a write carries its own one-request proof and never the read header.
      if (o.method === "GET") {
        const signed = await seatHeader(Date.now());
        if (signed) headers[SEAT_READ_HEADER] = signed;
      } else {
        const signed = await seatWriteHeaderValue(o.method, url, body ?? "");
        if (signed) headers[SEAT_WRITE_HEADER] = signed;
      }
    }
  } catch {
    // The key would not sign (storage revoked): the cookie alone may still carry the call.
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: o.method,
      headers,
      credentials: "include",
      cache: "no-store",
      ...(body === undefined ? {} : { body }),
    } as RequestInit);
  } catch (error) {
    return { ok: false, status: null, diagnosis: diagnosis("rpc-down", `ledger routes unreachable: ${error instanceof Error ? error.message : String(error)}`) };
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok && !o.okStatuses?.includes(res.status)) {
    const parsed = failureBody.safeParse(json);
    if (parsed.success) return { ok: false, status: res.status, diagnosis: parsed.data.diagnosis };
    const kind = res.status === 401 || res.status === 403 ? "signer-required" : "rpc-down";
    return { ok: false, status: res.status, diagnosis: diagnosis(kind, `${o.method} ${path} → ${res.status}`) };
  }
  const parsed = o.wire.safeParse(json);
  if (!parsed.success) return { ok: false, status: res.status, diagnosis: diagnosis("unknown", `${path} answered an unexpected shape: ${parsed.error.message.slice(0, 200)}`) };
  return { ok: true, value: parsed.data };
}
