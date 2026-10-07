/**
 * What every ticket-desk handler shares: the reply shapes, the seat taken from the web's body (the lease's party, never
 * the browser's), the Window's live ladder, shard leases, and a write on one reserve's queue with its stale-id retry.
 */
import { diagnosis, type DiagnosisKind } from "@owarine/core/types";
import type { Command } from "@owarine/ledger";
import { failureText, inactiveCids, isInactive, isIndefinite, refusalId } from "@owarine/markets/ops/canton";
import type { TicketReserveId } from "@owarine/markets/ops/tickets";
import type { LadderEntry } from "../market-maker/seat/ladder-board";
import { PoolBusyError, type Lease, type ShardPool } from "../quote-issuer/pool";
import { adoptCreated, submitWithPools, type Desk } from "./desk";

export type Answer = { status: number; body: unknown };
const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;
const LEASE_ID = /^[A-Za-z0-9_\-]{1,64}$/;

/** Bigints travel as decimal strings: the HTTP layer's `jsonText` writes them so. */
export const reply = (body: unknown): Answer => ({ status: 200, body });
export const refused = (kind: DiagnosisKind, technical: string): Answer => reply({ kind: "refused", diagnosis: diagnosis(kind, technical) });
export const nowSec = () => Math.floor(Date.now() / 1000);

/** Who the web says the seat is (taken from its lease row), checked for shape and against the infrastructure parties. */
export function seatOf(d: Desk, body: Record<string, unknown>): { party: string; leaseId: string } | Answer {
  const { party, leaseId } = body;
  if (typeof party !== "string" || !PARTY_ID.test(party)) return { status: 400, body: { diagnosis: diagnosis("unknown", "party must be a party id") } };
  if (typeof leaseId !== "string" || !LEASE_ID.test(leaseId)) return { status: 400, body: { diagnosis: diagnosis("unknown", "leaseId must be 1–64 of [A-Za-z0-9_-]") } };
  if (d.infrastructure.has(party)) return refused("unknown", "an infrastructure party is not a seat");
  return { party, leaseId };
}

export const isAnswer = (x: unknown): x is Answer => typeof x === "object" && x !== null && "status" in x && "body" in x;

export function split(body: unknown): { rest: Record<string, unknown>; seat: Record<string, unknown> } | null {
  if (typeof body !== "object" || body === null) return null;
  const { party, leaseId, ...rest } = body as Record<string, unknown>;
  return { rest, seat: { party, leaseId } };
}

export function windowFor(d: Desk, marketId: string): LadderEntry | Answer {
  const entry = d.board.get({ marketId });
  if (!entry || entry.state !== "quoting") return refused("market-not-trading", "the venue is not quoting this Window (no open print yet, or its quoting time is over)");
  return entry;
}

export async function lease(pool: ShardPool | null, amount: bigint, purpose: string): Promise<Lease | Answer> {
  if (!pool) return refused("not-deployed", "no shard pool in this ops process");
  try {
    return await pool.lease(amount, purpose);
  } catch (error) {
    if (error instanceof PoolBusyError) return refused("reserve-cap", `no ${purpose.split(" ")[0]} shard covers ${amount} right now; try again in a moment`);
    throw error;
  }
}

/** A write on one reserve's book or statement: its queue, a stale-id retry once, and the pools told what landed. */
export async function onReserve(d: Desk, reserve: TicketReserveId, held: ReadonlyArray<readonly [ShardPool, readonly Lease[]]>, build: (ids: { navCid: string; bookCid: string }) => { commandId: string; commands: Command[] }) {
  return d.lock(reserve, async () => {
    for (let attempt = 0; ; attempt++) {
      const l = d.live.get(reserve)!;
      if (!l.navCid || !l.bookCid) {
        await d.refresh();
        if (!l.navCid || !l.bookCid) throw new DeskRefusal("not-deployed", `the ${reserve} reserve has no statement or book on this participant: run the bootstrap`);
      }
      try {
        const input = build({ navCid: l.navCid!, bookCid: l.bookCid! });
        const out = await submitWithPools(d.venue, held, input);
        adoptCreated(d, reserve, out);
        return out;
      } catch (error) {
        // The book or statement moved under us (a publish from another process): read again, once.
        // (Read from the whole rejection: the logged `failureText` is cut at 240 characters, mid contract id.)
        if (attempt === 0 && isInactive(error) && inactiveCids(error, [l.navCid, l.bookCid].filter((c): c is string => c !== null)).length > 0) {
          await d.refresh();
          continue;
        }
        throw error;
      }
    }
  });
}

export class DeskRefusal extends Error {
  constructor(readonly kind: DiagnosisKind, technical: string) {
    super(technical);
  }
}

export function failed(d: Desk, what: string, error: unknown): Answer {
  if (error instanceof DeskRefusal) return refused(error.kind, error.message);
  if (isIndefinite(error)) return refused("send-unknown", `the ledger did not answer in time (${what}); the shards are held until its outcome is known`);
  const id = refusalId(error);
  d.log(`${what} refused: ${failureText(error)}`);
  const kind: DiagnosisKind = id && /over-|exposure/.test(id) ? "reserve-cap" : "contract-revert";
  return refused(kind, id ?? failureText(error).slice(0, 200));
}

