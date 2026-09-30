/**
 * `POST /internal/tickets/earn` with `reserve: "maker"` (abu-pm-main 0.5.0, K-092, K-200): the maker vault's provider
 * side and its two cranks. The seat is the lease's party (the web adds it), never the browser's.
 *
 *   supply     the statement is brought up to date first (on the vault's queue), then `Nav_IssueSupply` prices the
 *              shares from it: a firm `SupplyQuote` the seat alone accepts, its cash landing in `reserve:maker`
 *   withdraw   `Nav_IssueWithdraw` at the fresh statement, its cash locked from a `reserve:maker` shard: capital out in
 *              quotes and positions is not there to be taken (the ledger refuses any other shard)
 *   merge      the book's opposite legs on one Window netted now (`Leg_Merge`, pair first, then across pairs); legs of
 *              different sizes are split first (`Leg_Split`, K-201), so the crank nets min(up, down) as the reference's
 *              `public_merge` does
 *   settle     the book's legs and residuals on one resolved Window settled now (`Desk_SettleBatch`, `Residual_Settle`),
 *              and any of its legs past `refundAfter` refunded into the book (`Leg_RefundStale`, the venue's own)
 */
import { randomUUID } from "node:crypto";
import { TEMPLATE_IDS } from "@agari/daml";
import { marketIdFromDaml } from "@agari/core/market";
import { cmd, failureText, isInactive, netLegsCommandId, residualCommandId, settleBatchCommandId, submit, type Active, type LegC } from "@agari/markets/ops/canton";
import { bcmd } from "@agari/markets/ops/book";
import { decodeSupplyQuote, decodeWithdrawQuote, tcmd } from "@agari/markets/ops/tickets";
import type { EarnRequest } from "@agari/markets/server";
import { createdOne } from "../ticket-desk/desk";
import { failed, isAnswer, lease, refused, reply, type Answer } from "../ticket-desk/common";
import { submitWithShards } from "../quote-issuer/pooled-submit";
import type { MakerVault } from "./vault";

export const MAKER_QUOTE_LIFE_SEC = 30;
/** The most merges or settles one crank sends. */
const MAX_CRANK = 10;

export async function handleMakerEarn(v: MakerVault, req: EarnRequest, seat: { party: string }, deskCid: () => Promise<string>): Promise<Answer> {
  const nowSec = Math.floor(Date.now() / 1000);
  const validUntilSec = nowSec + MAKER_QUOTE_LIFE_SEC;
  const requestId = randomUUID();
  if (req.op === "merge" || req.op === "settle") return crank(v, req.op, req.marketId, deskCid);
  // Supply and withdraw price from the live statement: restate it first when the book moved.
  await v.publishNav().catch((error: unknown) => v.log(`maker NAV before ${req.op} failed: ${failureText(error)}`));
  if (req.op === "supply") {
    if (req.amountBase <= 0n) return refused("below-min-quantity", "supply must be positive");
    try {
      return await v.lock(async () => {
        const navCid = v.navCid;
        if (!navCid) return refused("not-deployed", "the maker vault has no statement on this participant: run the bootstrap");
        const out = await submit(v.venue, { commandId: `earn:supply:${requestId}`, commands: [tcmd.issueSupply(navCid, { provider: seat.party, cashIn: req.amountBase, validUntilSec })] });
        if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
        const q = createdOne(out, TEMPLATE_IDS.SupplyQuote, decodeSupplyQuote);
        if (!q) return refused("unknown", "the issue landed without a supply quote");
        v.log(`maker supply ${q.data.cashIn} → ${q.data.sharesOut} shares for ${seat.party.split("::")[0]}`);
        return reply({ kind: "supply-quote", quoteCid: q.cid, cashIn: q.data.cashIn, sharesOut: q.data.sharesOut, validUntilMs: validUntilSec * 1000 });
      });
    } catch (error) {
      return failed(deskLike(v), `maker supply ${requestId}`, error);
    }
  }
  if (req.op !== "withdraw") return refused("unknown", "unknown Earn op");
  const snap = v.snap ?? (await v.refresh());
  const shares = snap.lpShares.filter((s) => s.data.provider === seat.party).sort((a, b) => (a.data.shares > b.data.shares ? -1 : 1));
  const share = shares[0];
  if (!share) return refused("insufficient-collateral", "this seat holds no maker vault shares");
  if (req.shares <= 0n || req.shares > share.data.shares) {
    return refused("insufficient-collateral", shares.length > 1 ? `withdraw at most ${share.data.shares} shares at once (merge the seat's shares first)` : `this seat holds ${share.data.shares} shares`);
  }
  const nav = snap.nav;
  if (!nav || nav.data.shares === 0n) return refused("not-deployed", "the maker vault has no live statement");
  const cashOut = (req.shares * nav.data.assets) / nav.data.shares;
  if (cashOut <= 0n) return refused("below-min-quantity", "these shares redeem for nothing at this NAV");
  const shard = await lease(v.pool, cashOut, "maker withdraw");
  if (isAnswer(shard)) return refused("reserve-cap", `the vault's idle cash cannot pay ${cashOut} right now: the rest is deployed on live Windows and comes back as they settle`);
  try {
    return await v.lock(async () => {
      const navCid = v.navCid;
      if (!navCid) {
        v.pool.release([shard]);
        return refused("not-deployed", "the maker vault has no statement on this participant");
      }
      const out = await submitWithShards(v.pool, v.venue, [shard], {
        commandId: `earn:withdraw:${requestId}`,
        commands: [bcmd.issueMakerWithdraw(navCid, { provider: seat.party, lpShareCid: share.cid, sharesIn: req.shares, shardCid: shard.cid, validUntilSec })],
      });
      if (out.kind === "dry") return refused("not-deployed", `DRY RUN: ${out.note}`);
      const q = createdOne(out, TEMPLATE_IDS.WithdrawQuote, decodeWithdrawQuote);
      if (!q) return refused("unknown", "the issue landed without a withdraw quote");
      v.log(`maker withdraw ${q.data.sharesIn} shares → ${q.data.cashOut} for ${seat.party.split("::")[0]}`);
      return reply({ kind: "withdraw-quote", quoteCid: q.cid, sharesIn: q.data.sharesIn, cashOut: q.data.cashOut, validUntilMs: validUntilSec * 1000 });
    });
  } catch (error) {
    return failed(deskLike(v), `maker withdraw ${requestId}`, error);
  }
}

/** Pairs of the book's opposite legs on one Window: the same pair first, then equal size across pairs. Pure. */
export function planBookMerges(legs: readonly Active<LegC>[]): Array<[Active<LegC>, Active<LegC>]> {
  const out: Array<[Active<LegC>, Active<LegC>]> = [];
  const used = new Set<string>();
  const take = (a: Active<LegC>, b: Active<LegC>) => {
    out.push([a, b]);
    used.add(a.cid).add(b.cid);
  };
  const same = (a: LegC, b: LegC) => a.termsCid === b.termsCid && a.lots === b.lots && a.cashUnit === b.cashUnit && a.outcome !== b.outcome;
  for (const a of legs) {
    if (used.has(a.cid) || a.data.outcome !== "SideUp") continue;
    const b = legs.find((x) => !used.has(x.cid) && x.data.pairId === a.data.pairId && same(a.data, x.data));
    if (b) take(a, b);
  }
  for (const a of legs) {
    if (used.has(a.cid) || a.data.outcome !== "SideUp") continue;
    const b = legs.find((x) => !used.has(x.cid) && same(a.data, x.data));
    if (b) take(a, b);
  }
  return out;
}

/**
 * K-201: when no two opposite book legs on one Window are the same size, the split that makes a pair: the larger of an
 * Up and a Down (same terms and cash unit) cut to the smaller's lots. Legs a merge plan already uses are left alone. Pure.
 */
export function planBookSplit(legs: readonly Active<LegC>[]): { leg: Active<LegC>; lots: bigint } | null {
  const used = new Set(planBookMerges(legs).flatMap(([a, b]) => [a.cid, b.cid]));
  const free = legs.filter((l) => !used.has(l.cid));
  for (const a of free) {
    if (a.data.outcome !== "SideUp") continue;
    const b = free.find((x) => x.data.outcome !== "SideUp" && x.data.termsCid === a.data.termsCid && x.data.cashUnit === a.data.cashUnit && x.data.lots !== a.data.lots);
    if (!b) continue;
    return a.data.lots > b.data.lots ? { leg: a, lots: b.data.lots } : { leg: b, lots: a.data.lots };
  }
  return null;
}

async function crank(v: MakerVault, op: "merge" | "settle", marketId: string, deskCid: () => Promise<string>): Promise<Answer> {
  const snap = await v.refresh();
  const onWindow = <X extends { marketId: string }>(xs: Active<X>[]) => xs.filter((x) => marketIdFromDaml(x.data.marketId) === marketId);
  const legs = onWindow(snap.legs);
  const residuals = onWindow(snap.residuals);
  let done = 0;
  const notes: string[] = [];
  let splits = 0;
  const run = async (commandId: string, commands: Parameters<typeof submit>[1]["commands"], what: string, counts = true): Promise<boolean> => {
    try {
      const out = await submit(v.venue, { commandId, commands });
      if (out.kind === "done") {
        if (counts) done++;
        return true;
      }
      notes.push(out.note);
    } catch (error) {
      // Gone: the settler or netting got there first, which is the same outcome.
      if (!isInactive(error)) notes.push(`${what}: ${failureText(error).slice(0, 160)}`);
    }
    return false;
  };
  if (op === "merge") {
    const resolved = new Set(snap.resolutions.keys());
    let open = legs.filter((l) => !resolved.has(l.data.termsCid));
    // Merge what pairs; else split the larger of an unequal Up/Down to the smaller's size, re-read, and merge that.
    for (let round = 0; round < MAX_CRANK && done < MAX_CRANK; round++) {
      const merges = planBookMerges(open).slice(0, MAX_CRANK - done);
      if (merges.length > 0) {
        let landed = false;
        for (const [a, b] of merges) landed = (await run(netLegsCommandId(a.cid, b.cid), [cmd.mergeLegs(a.cid, b.cid)], "merge")) || landed;
        if (!landed) break;
      } else {
        const split = planBookSplit(open);
        if (!split) break;
        if (!(await run(`msplit:${split.leg.cid}`, [bcmd.splitBookLeg(split.leg.cid, split.lots)], "split", false))) break;
        splits++;
      }
      open = onWindow((await v.refresh()).legs).filter((l) => !resolved.has(l.data.termsCid));
    }
  } else {
    const nowSec = Math.floor(Date.now() / 1000);
    // Past `refundAfter` a leg cannot settle; the venue owns it, so it takes its own stale refund into the book.
    for (const l of legs.filter((x) => nowSec >= x.data.refundAfterSec).slice(0, MAX_CRANK)) {
      await run(`mrefund:${l.cid}`, [bcmd.refundBookLeg(l.cid)], "stale refund");
    }
    const byTerms = new Map<string, string[]>();
    for (const l of legs.filter((x) => nowSec < x.data.refundAfterSec)) byTerms.set(l.data.termsCid, [...(byTerms.get(l.data.termsCid) ?? []), l.cid]);
    for (const [termsCid, cids] of byTerms) {
      const res = snap.resolutions.get(termsCid);
      if (!res) continue;
      const batch = cids.slice(0, MAX_CRANK);
      await run(settleBatchCommandId(res.cid, batch), [cmd.settleBatch(await deskCid(), res.cid, batch)], "settle");
    }
    for (const x of residuals) {
      const res = snap.resolutions.get(x.data.termsCid);
      if (res) await run(residualCommandId(x.cid), [cmd.settleResidual(x.cid, res.cid)], "residual");
    }
  }
  if (done > 0) await v.refresh();
  if (done === 0 && notes.length) return refused("contract-revert", notes.join("; "));
  const note =
    done > 0
      ? `${op === "merge" ? "merged" : "settled"} ${done}${splits > 0 ? ` (after ${splits} split${splits > 1 ? "s" : ""})` : ""}`
      : op === "merge"
        ? "nothing to merge on this Window"
        : "nothing on this Window is ready to settle";
  v.log(`maker ${op} ${marketId}: ${note}`);
  return reply({ kind: "maker-op", op, done, note });
}

/** `failed` wants the desk's logger only. */
const deskLike = (v: MakerVault) => ({ log: v.log }) as Parameters<typeof failed>[0];

