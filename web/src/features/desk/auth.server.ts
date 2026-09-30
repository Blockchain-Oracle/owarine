import { isAddress, type Address } from "@agari/core/types";
import { NextResponse } from "next/server";
import { seatCaller } from "@/lib/auth/seat-caller.server";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { webEnv } from "@/lib/env";
import { deskStore, findDesk, type DbDesk, type DeskQueries } from "./desk.server";
import { DESK_SIGNATURE_TTL_MS } from "./protocol";

/**
 * The owner gate every desk route shares (D-012): the store must exist, the desk must exist, the caller must be its
 * owner, the signature must be the owner's over the exact text the route rebuilds, and the text's timestamp must be
 * fresh. Any failure is a plain refusal with a status; nothing here throws on attacker input.
 */
export const NO_STORE = { "cache-control": "no-store" };
export const DESK_ERRORS = {
  notConfigured: "desk index not configured",
  notFound: "no desk here",
  notShared: "this desk is not shared",
  badRequest: "bad request",
  notOwner: "that is not your desk",
  staleSignature: "the signature is too old; sign again",
  badSignature: "the signature does not match",
  mandateVersion: "the mandate changed since you loaded it; reload and sign again",
  mandateProblems: "the mandate does not hold together",
  approvalGone: "that request is no longer waiting",
  practiceOnly: "a practice desk has no ledger mode; go live first",
  chainMismatch: "the desk on the ledger does not match what you signed",
  notSupported: "this desk index does not carry that request yet",
} as const;

export const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: NO_STORE });
export const answer = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export function fresh(iso: string, nowMs: number): boolean {
  const at = Date.parse(iso);
  return Number.isFinite(at) && Math.abs(nowMs - at) <= DESK_SIGNATURE_TTL_MS;
}

export type Loaded = { store: DeskQueries; desk: DbDesk | null; key: string; keyIsAddress: boolean };

/** The store and the desk named by the route's `[owner]` segment (an owner address or a desk id), or the refusal. */
export async function loadDesk(key: string): Promise<Loaded | NextResponse> {
  const store = deskStore();
  if (!store) return refuse(503, DESK_ERRORS.notConfigured);
  const keyIsAddress = isAddress(key);
  const desk = await findDesk(store, key, keyIsAddress);
  return { store, desk, key, keyIsAddress };
}

export async function verifyOwner(i: { owner: string; text: string; signature: string; desk: DbDesk | null; signedAtIso?: string; nowMs: number }): Promise<NextResponse | null> {
  if (i.desk && i.desk.owner !== i.owner) return refuse(403, DESK_ERRORS.notOwner);
  if (i.signedAtIso !== undefined && !fresh(i.signedAtIso, i.nowMs)) return refuse(400, DESK_ERRORS.staleSignature);
  const ok = await verifyWalletMessage({ text: i.text, signature: i.signature as never, signer: i.owner as never });
  return ok ? null : refuse(401, DESK_ERRORS.badSignature);
}

/**
 * The `?viewer=` a desk read names, only when the caller proves it is that seat (C13a): the web's seat cookie or the
 * phone's signed read header, as `/api/index` checks a seat's own rows. The owner view carries the owner's private
 * notes and the mandate's live state, so an address typed into a query string is never enough; an unproven viewer
 * reads as a visitor.
 */
export async function provenViewer(req: Request): Promise<Address | null> {
  const claimed = new URL(req.url).searchParams.get("viewer");
  if (!claimed || !isAddress(claimed)) return null;
  const caller = await seatCaller(req.headers, webEnv.markets.cluster);
  return caller === claimed ? claimed : null;
}

/** A body that failed zod, an unreadable body, or a store failure, in one line each. */
export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
