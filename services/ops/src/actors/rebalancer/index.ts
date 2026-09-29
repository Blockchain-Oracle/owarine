/**
 * The rebalancer (review B3): expiries, settlement fees and quote change leave the venue with many small cash
 * contracts. It merges the small free ones back into one shard (`VenueCash_Merge`, `merge:<digest>`) and splits an
 * oversized one to the target size (`VenueCash_Split`, `split:<cid>`), leasing from the issuer's pool so it never
 * races a quote for the same shard.
 */
import { cmd, failureText, mergeCashCommandId, splitCashCommandId, type RoleSession } from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import type { ShardPool } from "../quote-issuer/pool";
import { submitWithShards } from "../quote-issuer/pooled-submit";

export interface RebalanceSettings {
  /** The shard size the bootstrap credits (base units). */
  targetBase: bigint;
  /** Free shards below `targetBase / smallDivisor` are merged. */
  smallDivisor: bigint;
  /** A free shard above `targetBase × bigMultiple` is split. */
  bigMultiple: bigint;
  maxMerge: number;
}

export function readRebalanceSettings(env: NodeJS.ProcessEnv = process.env): RebalanceSettings {
  const target = env.REBALANCE_TARGET_BASE && /^\d+$/.test(env.REBALANCE_TARGET_BASE) ? BigInt(env.REBALANCE_TARGET_BASE) : 2_000_000_000n;
  return { targetBase: target, smallDivisor: 4n, bigMultiple: 3n, maxMerge: 20 };
}

export function startRebalancer(input: { venue: RoleSession; pool: ShardPool; log: (why: string) => void; settings?: RebalanceSettings }): { stop: () => void } {
  const s = input.settings ?? readRebalanceSettings();
  const counters = { merges: 0, merged: 0, splits: 0, failed: 0 };
  const pass = async (): Promise<PassResult> => {
    const notes: string[] = [];
    const smallCount = input.pool.all().filter((x) => x.state === "free" && x.amount < s.targetBase / s.smallDivisor).length;
    if (smallCount >= 2) {
      const leases = input.pool.leaseWhere((x) => x.amount < s.targetBase / s.smallDivisor, s.maxMerge, "merge");
      const [first, ...rest] = leases;
      if (first && rest.length > 0) {
        try {
          const out = await submitWithShards(input.pool, input.venue, leases, { commandId: mergeCashCommandId(leases.map((l) => l.cid)), commands: [cmd.mergeCash(first.cid, rest.map((l) => l.cid))] });
          if (out.kind === "done") {
            counters.merges++;
            counters.merged += leases.length;
          }
          notes.push(`${out.kind === "dry" ? "DRY " : ""}merged ${leases.length} small shards`);
        } catch (error) {
          counters.failed++;
          notes.push(`merge failed: ${failureText(error)}`);
        }
      } else input.pool.release(leases);
    }
    const [big] = input.pool.leaseWhere((x) => x.amount > s.targetBase * s.bigMultiple, 1, "split");
    if (big) {
      try {
        const out = await submitWithShards(input.pool, input.venue, [big], { commandId: splitCashCommandId(big.cid), commands: [cmd.splitCash(big.cid, s.targetBase)] });
        if (out.kind === "done") counters.splits++;
        notes.push(`${out.kind === "dry" ? "DRY " : ""}split ${s.targetBase} off a ${big.amount} shard`);
      } catch (error) {
        counters.failed++;
        notes.push(`split failed: ${failureText(error)}`);
      }
    }
    const st = input.pool.stats();
    return { why: `${st.free + st.inflight + st.quarantined} shards, ${st.totalBase} base${notes.length ? ` · ${notes.join(" · ")}` : ""}`, detail: { ...counters } };
  };
  return runActor({ name: "rebalancer", log: input.log, dryRun: input.venue.dryRun, everyMs: 15_000, pass });
}
