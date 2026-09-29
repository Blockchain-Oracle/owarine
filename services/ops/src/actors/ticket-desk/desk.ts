/**
 * The ticket desk's shared machinery (C8c): the per-reserve single writer (every `RiskBook` issue, NAV publish and
 * withdraw quote on one reserve goes through one queue, because each consumes or fetches that reserve's live book or
 * statement), one shard pool per reserve bucket beside the venue's own pool, and the live book / statement ids.
 */
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import { activeOf, inactiveCids, isInactive, isIndefinite, submit, templateSuffix, type RoleSession, type SubmitInput, type SubmitOutcome } from "@agari/markets/ops/canton";
import { TICKET_RESERVES, type TicketReserveId } from "@agari/markets/ops/tickets";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import { ShardPool, type Lease } from "../quote-issuer/pool";
import { archivedCids, venueCashCreated } from "../quote-issuer/pooled-submit";
import { readDesk, reserveBucket, type DeskSnapshot } from "./state";

export interface Live {
  navCid: string | null;
  bookCid: string | null;
  /** Bumped by every write that replaces the book or the statement, so a snapshot read before it is not applied. */
  writes: number;
}

export interface Desk {
  venue: RoleSession;
  board: LadderBoard;
  /** The venue's trading shards (the issuer's pool): a boost's house stake, an exit's price, a knock-out's proceeds. */
  venuePool: ShardPool | null;
  reservePools: Map<TicketReserveId, ShardPool>;
  live: Map<TicketReserveId, Live>;
  earnDeskCid: string | null;
  infrastructure: ReadonlySet<string>;
  draining?: ReadonlySet<string>;
  log: (why: string) => void;
  /** The last snapshot (the keeper refreshes it every pass). */
  snap: DeskSnapshot | null;
  /** Runs `fn` alone on `reserve`'s queue. */
  lock<T>(reserve: TicketReserveId, fn: () => Promise<T>): Promise<T>;
  /** A fresh snapshot, applied to the live ids and the pools. */
  refresh(): Promise<DeskSnapshot>;
}

export function createDesk(input: { venue: RoleSession; board: LadderBoard; venuePool: ShardPool | null; infrastructure: ReadonlySet<string>; draining?: ReadonlySet<string>; log: (why: string) => void }): Desk {
  const queues = new Map<TicketReserveId, Promise<unknown>>();
  const reservePools = new Map<TicketReserveId, ShardPool>();
  const live = new Map<TicketReserveId, Live>();
  for (const id of TICKET_RESERVES) {
    const bucket = reserveBucket(id);
    reservePools.set(id, new ShardPool({ venue: input.venue.party, maxWaitMs: 3_000, bucket: (b) => b === bucket }));
    live.set(id, { navCid: null, bookCid: null, writes: 0 });
  }
  const desk: Desk = {
    ...input,
    reservePools,
    live,
    earnDeskCid: null,
    snap: null,
    lock<T>(reserve: TicketReserveId, fn: () => Promise<T>): Promise<T> {
      const prev = queues.get(reserve) ?? Promise.resolve();
      const next = prev.catch(() => undefined).then(fn);
      queues.set(reserve, next.catch(() => undefined));
      return next;
    },
    async refresh() {
      const before = new Map([...live].map(([id, l]) => [id, l.writes]));
      const snap = await readDesk(input.venue, (cid, error) => input.log(`undecodable ${cid.slice(0, 12)}…: ${String(error)}`));
      desk.snap = snap;
      desk.earnDeskCid = snap.earnDeskCid;
      for (const id of TICKET_RESERVES) {
        const l = live.get(id)!;
        // A write that landed while this snapshot was being read left newer ids than the snapshot's.
        if (l.writes === before.get(id)) {
          l.navCid = snap.navs.get(id)?.cid ?? null;
          l.bookCid = snap.books.get(id)?.cid ?? null;
        }
        reservePools.get(id)!.sync(snap.cash.get(id) ?? []);
      }
      return snap;
    },
  };
  return desk;
}

/** Records the book and statement a write created as the reserve's live ones. */
export function adoptCreated(desk: Desk, reserve: TicketReserveId, out: SubmitOutcome): void {
  if (out.kind !== "done") return;
  const l = desk.live.get(reserve)!;
  for (const e of out.created) {
    const suffix = templateSuffix(e.templateId);
    const rid = (e.createArgument as { reserveId?: unknown }).reserveId;
    if (rid !== reserve) continue;
    if (suffix === templateSuffix(TICKET_TEMPLATE_IDS.RiskBook)) {
      l.bookCid = e.contractId;
      l.writes++;
    } else if (suffix === templateSuffix(TEMPLATE_IDS.NavStatement)) {
      l.navCid = e.contractId;
      l.writes++;
    }
  }
}

/**
 * One venue write that consumes shards from several pools at once (a boost's reserve front and the venue's house
 * stake): submitted once, then each pool is told what the ledger did with its own leases, as `submitWithShards` does.
 */
export async function submitWithPools(session: RoleSession, held: ReadonlyArray<readonly [ShardPool, readonly Lease[]]>, input: SubmitInput): Promise<SubmitOutcome> {
  const beginOffset = await session.client.ledgerEnd().catch(() => 0);
  try {
    const out = await submit(session, input);
    for (const [pool, leases] of held) {
      if (out.kind === "dry") pool.release(leases);
      else pool.complete(leases, archivedCids(out), venueCashCreated(out));
    }
    return out;
  } catch (error) {
    for (const [pool, leases] of held) {
      if (isIndefinite(error)) pool.quarantine(leases, input.commandId, beginOffset);
      else pool.release(leases, isInactive(error) ? new Set(inactiveCids(error, leases.map((l) => l.cid))) : new Set());
    }
    throw error;
  }
}

/** The created contract of one template in a landed write, decoded. */
export function createdOne<X>(out: SubmitOutcome, templateId: string, decode: (v: unknown) => X): { cid: string; data: X } | null {
  if (out.kind !== "done") return null;
  const e = out.created.find((c) => templateSuffix(c.templateId) === templateSuffix(templateId));
  return e ? activeOf(e, decode) : null;
}
