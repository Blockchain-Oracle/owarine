/**
 * The client half of the ticket products (C8c): every read and price goes through our own routes
 * (`/api/ledger/tickets/*`), same-origin in the browser, the phone's absolute URL otherwise. No party, ledger URL or
 * credential here. The screens keep the reference's numeric ids (`roundId`, `parlayId`, `positionId`); on Canton a
 * ticket is a contract, so its id is the first 52 bits of its contract id, and this module remembers which contract
 * each id it handed out stands for.
 */
import { err, ok, type Reading } from "@owarine/core/schemas";
import { seriesIdFromDaml } from "@owarine/core/market";
import { diagnosis, type Address } from "@owarine/core/types";
import { ledgerRequest } from "../provider/ledger-api";
import { meReplyWire } from "../provider/ledger-wire";
import {
  boostTicketReplyWire, earnReplyWire, parlayTicketReplyWire, rangeTicketReplyWire, ticketsMineWire, ticketStateReplyWire,
  type BoostTicketReply, type EarnReply, type ParlayTicketReply, type RangeTicketReply, type TicketReserveState, type TicketsMine, type TicketStateReply,
} from "../provider/ticket-wire";
import { nowMs } from "../provider/clock";
import type { EarnReserveId, TicketReserveId } from "./params";

export type TicketKind = "range" | "parlay" | "boost";

/** A ticket's numeric id: the contract id's first 52 bits after its version byte (safe as a JS number, unique in practice). */
export function ticketIdOf(cid: string): bigint {
  return BigInt(`0x${cid.slice(2, 15)}`);
}

const known = new Map<string, string>();
const key = (kind: TicketKind, id: bigint) => `${kind}:${id}`;

/** Records the contract behind an id this module hands a screen, and returns the id. */
export function rememberTicket(kind: TicketKind, cid: string): bigint {
  const id = ticketIdOf(cid);
  known.set(key(kind, id), cid);
  return id;
}

/** The contract a screen's id stands for: remembered, or found in a fresh read of the seat's tickets. */
export async function ticketCidOf(kind: TicketKind, id: bigint): Promise<string | null> {
  const hit = known.get(key(kind, id));
  if (hit) return hit;
  const mine = await readTicketsMine({ fresh: true });
  if (!mine.ok) return null;
  const list = kind === "range" ? mine.value.rounds : kind === "parlay" ? mine.value.parlays : mine.value.positions;
  for (const t of list) rememberTicket(kind, t.cid);
  return known.get(key(kind, id)) ?? null;
}

/** A reserve's address-shaped id, for the reference's `deployment` field: derived, stable, never a chain address. */
export const reserveAddressOf = (reserve: EarnReserveId): Address => seriesIdFromDaml(`agari-reserve:${reserve}`);

// ---- reads ------------------------------------------------------------------------------------------------

const STATE_CACHE_MS = 2_000;
const MINE_CACHE_MS = 1_500;
let stateCache: { atMs: number; value: Promise<Reading<TicketStateReply>> } | null = null;
let mineCache: { atMs: number; value: Promise<Reading<TicketsMine>> } | null = null;

/** The three reserves as ops read them from the ledger. */
export function readTicketState(o: { fresh?: boolean } = {}): Promise<Reading<TicketStateReply>> {
  if (!o.fresh && stateCache && Date.now() - stateCache.atMs < STATE_CACHE_MS) return stateCache.value;
  const value = ledgerRequest("/tickets/state", { method: "GET", wire: ticketStateReplyWire, seat: false }).then((r) => (r.ok ? ok(r.value, nowMs()) : err(r.diagnosis)));
  stateCache = { atMs: Date.now(), value };
  return value;
}

export async function readReserve(reserve: TicketReserveId): Promise<Reading<TicketReserveState | null>> {
  const s = await readTicketState();
  if (!s.ok) {
    // No ticket desk on this deployment (or no seat tier): the reserve is not live here, which is an answer, not a fault.
    return s.error.kind === "not-deployed" ? ok(null, nowMs()) : s;
  }
  const r = s.value.reserves.find((x) => x.reserveId === reserve) ?? null;
  return ok(r && !r.paused ? r : null, s.asOfMs);
}

/** The seat's own tickets and shares; empty (never an error) without a seat. */
export function readTicketsMine(o: { fresh?: boolean } = {}): Promise<Reading<TicketsMine>> {
  if (!o.fresh && mineCache && Date.now() - mineCache.atMs < MINE_CACHE_MS) return mineCache.value;
  const value = ledgerRequest("/tickets/mine", { method: "GET", wire: meReplyWire }).then((r): Reading<TicketsMine> => {
    if (!r.ok) {
      if (r.diagnosis.kind === "signer-required" || r.diagnosis.kind === "not-deployed") return ok({ rounds: [], parlays: [], positions: [], shares: [], receipts: [] }, nowMs());
      return err(r.diagnosis);
    }
    const parsed = ticketsMineWire.safeParse(r.value.value);
    if (!parsed.success) return err(diagnosis("unknown", `/tickets/mine answered an unexpected shape: ${parsed.error.message.slice(0, 200)}`));
    for (const t of parsed.data.rounds) rememberTicket("range", t.cid);
    for (const t of parsed.data.parlays) rememberTicket("parlay", t.cid);
    for (const t of parsed.data.positions) rememberTicket("boost", t.cid);
    return ok(parsed.data, nowMs());
  });
  mineCache = { atMs: Date.now(), value };
  return value;
}

/** After a write: the next reads go to the routes. */
export function forgetTicketReads(): void {
  stateCache = null;
  mineCache = null;
}

// ---- prices and firm quotes -----------------------------------------------------------------------------------

type Call<T> = { ok: true; value: T } | { ok: false; diagnosis: import("@owarine/core/types").Diagnosis };

export async function rangeCall(body: Record<string, unknown>): Promise<Call<RangeTicketReply>> {
  return ledgerRequest("/tickets/range", { method: "POST", body, wire: rangeTicketReplyWire });
}
export async function parlayCall(body: Record<string, unknown>): Promise<Call<ParlayTicketReply>> {
  return ledgerRequest("/tickets/parlay", { method: "POST", body, wire: parlayTicketReplyWire });
}
export async function boostCall(body: Record<string, unknown>): Promise<Call<BoostTicketReply>> {
  return ledgerRequest("/tickets/boost", { method: "POST", body, wire: boostTicketReplyWire });
}
export async function earnCall(body: Record<string, unknown>): Promise<Call<EarnReply>> {
  return ledgerRequest("/tickets/earn", { method: "POST", body, wire: earnReplyWire });
}

/** A preview reply as a `Reading`: the price, or the reserve's own refusal. */
export function asReading<R extends { kind: string }, T>(call: Call<R>, pick: (reply: R) => T | null): Reading<T> {
  if (!call.ok) return err(call.diagnosis);
  const reply = call.value as R & { diagnosis?: import("@owarine/core/types").Diagnosis };
  if (reply.kind === "refused" && reply.diagnosis) return err(reply.diagnosis);
  const value = pick(call.value);
  return value === null ? err(diagnosis("unknown", `unexpected ${reply.kind} reply`)) : ok(value, nowMs());
}

export type { TicketsMine, TicketReserveState };
