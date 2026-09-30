/**
 * A visitor's seat as the browser holds it (C4a, `seat-routes-it.ts`): an Ed25519 key in WebCrypto, a signed lease
 * that sets the HttpOnly seat cookie, and every write carrying our Origin and the seat header (the CSRF rule). Calls go
 * to the web directly, or through another base URL (the drop proxy) with the same Origin.
 */
import { webcrypto } from "node:crypto";
import { messageBytes } from "@agari/core/auth";
import { encodeBase58, type Address } from "@agari/core/types";
import { seatLeaseText, toWire } from "@agari/markets";

export type Cluster = Parameters<typeof seatLeaseText>[2];

export interface Seat {
  name: string;
  address: Address;
  sign: (text: string) => Promise<string>;
  cookie: string;
  party?: string;
  leaseId?: string;
}

export interface Reply {
  status: number;
  // The web's JSON; the drive checks the fields it needs.
  json: Record<string, any>;
}

export async function newSeat(name: string): Promise<Seat> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as { publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey };
  const address = encodeBase58(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) as Address;
  const sign = async (text: string) => encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, messageBytes(text) as Uint8Array<ArrayBuffer>)));
  return { name, address, sign, cookie: "" };
}

export function webClient(web: string, cluster: Cluster) {
  async function call(seat: Seat | null, method: string, path: string, body?: unknown, o: { via?: string; timeoutMs?: number } = {}): Promise<Reply> {
    const headers: Record<string, string> = { accept: "application/json", origin: web, "x-agari-seat": "1" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (seat?.cookie) headers.cookie = seat.cookie;
    const res = await fetch(`${o.via ?? web}${path}`, {
      method, headers, signal: AbortSignal.timeout(o.timeoutMs ?? 180_000),
      ...(body === undefined ? {} : { body: JSON.stringify(toWire(body)) }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (seat && setCookie?.startsWith("agari_seat=")) seat.cookie = setCookie.split(";")[0]!;
    const json = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, json: json ?? {} };
  }

  async function lease(seat: Seat): Promise<Reply> {
    const issuedAtMs = Date.now();
    const r = await call(seat, "POST", "/api/seat", { address: seat.address, issuedAtMs, signature: await seat.sign(seatLeaseText(seat.address, issuedAtMs, cluster)) });
    if (r.json.kind === "leased") {
      seat.party = r.json.party as string;
      seat.leaseId = r.json.leaseId as string;
    }
    return r;
  }

  /** The seat's spendable demo cash, base units. */
  async function balance(seat: Seat): Promise<bigint> {
    const r = await call(seat, "GET", "/api/ledger/me/balance");
    if (r.status !== 200) throw new Error(`balance read refused (${r.status}): ${JSON.stringify(r.json).slice(0, 200)}`);
    return BigInt(r.json.value?.spendableBase ?? 0);
  }

  return { call, lease, balance };
}

export type WebClient = ReturnType<typeof webClient>;
