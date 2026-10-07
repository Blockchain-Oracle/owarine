/**
 * The venue's cash-shard pool (review B2; plan "seed maker → issuer"): the in-process single writer over the venue's
 * `VenueCash` shards. A lease is a synchronous pop of the smallest free shard that covers the stake, so two requests
 * can never hold one shard; waiters queue FIFO for up to `maxWaitMs`, then are refused with blocker copy.
 *
 *   free → in-flight (leased) → gone (consumed; its change joins as free)
 *                             → free (definite rejection, shard untouched)
 *                             → quarantined (timeout / 503: outcome unknown) → gone or free once the completion for
 *                               that commandId is known
 *
 * The sweeper, the rebalancer and netting lease from this same pool, which is what makes the single writer real. The
 * pool holds no persistent state: at boot it is rebuilt from the venue's active contracts.
 */
import type { Active, VenueCashC } from "@owarine/markets/ops/canton";

export type ShardState = "free" | "inflight" | "quarantined";

export interface Shard {
  cid: string;
  amount: bigint;
  state: ShardState;
  sinceMs: number;
  purpose?: string;
  commandId?: string;
  /** Ledger offset before the in-flight submit, where a completion scan starts. */
  beginOffset?: number;
}

export interface Lease {
  cid: string;
  amount: bigint;
}

export class PoolBusyError extends Error {
  override readonly name = "PoolBusyError";
}

interface Waiter {
  minAmount: bigint;
  purpose: string;
  resolve: (l: Lease) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const TOMBSTONE_MS = 60_000;

/** Buckets that are the venue's own trading cash (reserve and private buckets are other books). */
export const isShardBucket = (bucket: string) => !bucket.startsWith("reserve") && !bucket.startsWith("private");

export class ShardPool {
  private readonly shards = new Map<string, Shard>();
  private readonly waiters: Waiter[] = [];
  /** Shards this process saw consumed, so a snapshot read before the consuming write cannot bring them back. */
  private readonly tombstones = new Map<string, number>();

  /** `bucket` picks the cash this pool leases: the venue's trading shards by default, one reserve's bucket for a ticket reserve (C8c). */
  constructor(private readonly opts: { venue: string; maxWaitMs?: number; bucket?: (bucket: string) => boolean }) {}

  private accepts(bucket: string): boolean {
    return (this.opts.bucket ?? isShardBucket)(bucket);
  }

  /** Reconciles with a fresh read of the venue's cash: new shards join free; free or quarantined ones that vanished are dropped. */
  sync(active: readonly Active<VenueCashC>[]): { added: number; dropped: number } {
    const seen = new Set<string>();
    let added = 0;
    let dropped = 0;
    const nowMs = Date.now();
    for (const [cid, atMs] of this.tombstones) if (nowMs - atMs > TOMBSTONE_MS) this.tombstones.delete(cid);
    for (const c of active) {
      if (c.data.owner !== this.opts.venue || c.data.venue !== this.opts.venue || !this.accepts(c.data.bucket) || this.tombstones.has(c.cid)) continue;
      seen.add(c.cid);
      if (!this.shards.has(c.cid)) {
        this.shards.set(c.cid, { cid: c.cid, amount: c.data.amount, state: "free", sinceMs: Date.now() });
        added++;
      }
    }
    for (const s of [...this.shards.values()]) {
      if (s.state !== "inflight" && !seen.has(s.cid)) {
        this.shards.delete(s.cid);
        dropped++;
      }
    }
    if (added > 0) this.serveWaiters();
    return { added, dropped };
  }

  private pickFree(minAmount: bigint, exclude: ReadonlySet<string> = new Set()): Shard | null {
    let best: Shard | null = null;
    for (const s of this.shards.values()) {
      if (s.state !== "free" || s.amount < minAmount || exclude.has(s.cid)) continue;
      if (!best || s.amount < best.amount) best = s;
    }
    return best;
  }

  private take(s: Shard, purpose: string): Lease {
    s.state = "inflight";
    s.sinceMs = Date.now();
    s.purpose = purpose;
    return { cid: s.cid, amount: s.amount };
  }

  /** The smallest free shard covering `minAmount`, now or within `maxWaitMs` (FIFO), else `PoolBusyError`. */
  lease(minAmount: bigint, purpose: string): Promise<Lease> {
    const now = this.pickFree(minAmount);
    if (now && this.waiters.length === 0) return Promise.resolve(this.take(now, purpose));
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        minAmount, purpose, resolve, reject,
        timer: setTimeout(() => {
          const i = this.waiters.indexOf(waiter);
          if (i >= 0) this.waiters.splice(i, 1);
          reject(new PoolBusyError(`no venue shard of ${minAmount} free within ${this.opts.maxWaitMs ?? 3_000} ms`));
        }, this.opts.maxWaitMs ?? 3_000),
      };
      this.waiters.push(waiter);
      this.serveWaiters();
    });
  }

  /** Every free shard matching `filter` (the rebalancer's small shards), up to `max`, leased at once. */
  leaseWhere(filter: (s: Shard) => boolean, max: number, purpose: string): Lease[] {
    const out: Lease[] = [];
    for (const s of this.shards.values()) {
      if (out.length >= max) break;
      if (s.state === "free" && filter(s)) out.push(this.take(s, purpose));
    }
    return out;
  }

  /** In arrival order; a waiter no free shard can cover yet does not block a smaller one behind it. */
  private serveWaiters(): void {
    for (let i = 0; i < this.waiters.length; ) {
      const w = this.waiters[i]!;
      const s = this.pickFree(w.minAmount);
      if (!s) {
        i++;
        continue;
      }
      this.waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(this.take(s, w.purpose));
    }
  }

  /** The command landed: the leased shards named in `consumed` are gone, the rest go back, and `created` change joins free. */
  complete(leases: readonly Lease[], consumed: ReadonlySet<string>, created: readonly Active<VenueCashC>[]): void {
    for (const l of leases) {
      const s = this.shards.get(l.cid);
      if (!s) continue;
      if (consumed.has(l.cid)) this.forget(l.cid);
      else Object.assign(s, { state: "free", sinceMs: Date.now(), purpose: undefined });
    }
    for (const c of created) {
      if (c.data.owner !== this.opts.venue || c.data.venue !== this.opts.venue || !this.accepts(c.data.bucket) || this.shards.has(c.cid)) continue;
      this.shards.set(c.cid, { cid: c.cid, amount: c.data.amount, state: "free", sinceMs: Date.now() });
    }
    this.serveWaiters();
  }

  /** A definite rejection: the shard is free again, or dropped when the rejection says it no longer exists. */
  release(leases: readonly Lease[], gone: ReadonlySet<string> = new Set()): void {
    for (const l of leases) {
      const s = this.shards.get(l.cid);
      if (!s) continue;
      if (gone.has(l.cid)) this.forget(l.cid);
      else Object.assign(s, { state: "free", sinceMs: Date.now(), purpose: undefined });
    }
    this.serveWaiters();
  }

  /** An indefinite failure: hold the shards until the completion for `commandId` is known. */
  quarantine(leases: readonly Lease[], commandId: string, beginOffset: number): void {
    for (const l of leases) {
      const s = this.shards.get(l.cid);
      if (s) Object.assign(s, { state: "quarantined", sinceMs: Date.now(), commandId, beginOffset });
    }
  }

  private forget(cid: string): void {
    this.shards.delete(cid);
    this.tombstones.set(cid, Date.now());
  }

  quarantined(): Shard[] {
    return [...this.shards.values()].filter((s) => s.state === "quarantined");
  }

  /** Frees a quarantined shard whose command is known not to have landed (the shard is still active). */
  unquarantine(cid: string, landed: boolean): void {
    const s = this.shards.get(cid);
    if (!s || s.state !== "quarantined") return;
    if (landed) this.forget(cid);
    else Object.assign(s, { state: "free", sinceMs: Date.now(), commandId: undefined, beginOffset: undefined });
    this.serveWaiters();
  }

  all(): Shard[] {
    return [...this.shards.values()];
  }

  stats(): { free: number; inflight: number; quarantined: number; freeBase: bigint; totalBase: bigint; waiting: number } {
    let free = 0, inflight = 0, quarantined = 0, freeBase = 0n, totalBase = 0n;
    for (const s of this.shards.values()) {
      totalBase += s.amount;
      if (s.state === "free") {
        free++;
        freeBase += s.amount;
      } else if (s.state === "inflight") inflight++;
      else quarantined++;
    }
    return { free, inflight, quarantined, freeBase, totalBase, waiting: this.waiters.length };
  }
}
