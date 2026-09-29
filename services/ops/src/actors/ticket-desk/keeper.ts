/**
 * The ticket keeper (C8c; the reference's settle/keeper crons, C-OPS-09): one pass every few seconds, the venue's
 * side of every ticket after issue. In order:
 *
 *   settle     `Round_Settle`, `Ticket_ResolveLeg` (the next leg, in expiry order), `Boost_Settle` against each
 *              Window's own `Resolution`, before `refundAfter`         tsettle:<cid>, tleg:<cid>, tboost:<cid>
 *   knock-out  `Boost_KnockOut` when the Window's own oracle quorum printed at or beyond the barrier at a boundary of
 *              the position's life (never unilaterally; a 1x boost has no barrier)                    tko:<cid>
 *   expire     unaccepted range / parlay / boost / exit / supply / withdraw quotes past validUntil + slack
 *                                                                                                     texp:<cid>
 *   prune      `Book_Prune` of the boundaries that have passed                                  tprune:<book>:<t>
 *   NAV        `Earn_PublishNav` per reserve when what it counts changed, or every minute    tnav:<reserve>:<seq>
 *   merge      a reserve's small cash pieces into one (`VenueCash_Merge`)                         tmerge:<digest>
 *
 * Every write carries a stable command id, so a crash-retry is deduplicated by the participant. Settle and claim race
 * the owner's own `*_Claim`: whichever lands first pays, the other finds the ticket gone.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import type { Command } from "@agari/ledger";
import { cmd, decodePriceQuote, decodeTerms, digest, failureText, isInactive, pick, readActive, submit, type Active, type PriceQuoteC, type TermsC } from "@agari/markets/ops/canton";
import { nextParlayLeg, tcmd, TICKET_RESERVES, type BoostPositionC } from "@agari/markets/ops/tickets";
import type { PassResult } from "../../runtime/actor";
import { PoolBusyError } from "../quote-issuer/pool";
import { submitWithShards } from "../quote-issuer/pooled-submit";
import { adoptCreated, type Desk } from "./desk";
import { navInputsOf, type DeskSnapshot } from "./state";

/** Seconds past `validUntil` before a quote may be expired (the ledger's `expireSlackSec` plus a margin). */
const EXPIRE_SLACK_SEC = 7;
const MAX_WRITES_PER_PASS = 40;
const NAV_EVERY_SEC = 60;
const MERGE_ABOVE = 6;

export async function keeperPass(d: Desk): Promise<PassResult> {
  const snap = await d.refresh();
  const now = Math.floor(Date.now() / 1000);
  const notes: string[] = [];
  let writes = 0;
  const run = async (commandId: string, commands: Command[], what: string): Promise<boolean> => {
    if (writes >= MAX_WRITES_PER_PASS) return false;
    writes++;
    try {
      const out = await submit(d.venue, { commandId, commands });
      return out.kind === "done";
    } catch (error) {
      // Gone: the owner claimed, or another pass got there. Anything else is logged and retried next pass.
      if (!isInactive(error)) d.log(`${what} failed: ${failureText(error)}`);
      return false;
    }
  };

  const counts = { settled: 0, legs: 0, knocked: 0, expired: 0, pruned: 0, navs: 0, merged: 0 };

  // ---- settle -------------------------------------------------------------------------------------
  for (const r of snap.rounds) {
    const res = snap.resolutions.get(r.data.termsCid);
    if (!res || now >= r.data.refundAfterSec) continue;
    if (await run(`tsettle:${r.cid}`, [tcmd.settleRound(r.cid, res.cid)], `range settle ${r.data.marketId}`)) counts.settled++;
  }
  for (const t of snap.tickets) {
    const i = nextParlayLeg(t.data.legs);
    if (i === null || now >= t.data.voidAfterSec) continue;
    const leg = t.data.legs[i]!;
    const res = snap.resolutions.get(leg.termsCid);
    if (!res) continue;
    if (await run(`tleg:${t.cid}`, [tcmd.resolveParlayLeg(t.cid, res.cid)], `parlay leg ${leg.marketId}`)) counts.legs++;
  }
  for (const p of snap.positions) {
    const res = snap.resolutions.get(p.data.termsCid);
    if (!res || now >= p.data.refundAfterSec) continue;
    if (await run(`tboost:${p.cid}`, [tcmd.settleBoost(p.cid, res.cid)], `boost settle ${p.data.marketId}`)) counts.settled++;
  }

  // ---- knock-out --------------------------------------------------------------------------------------
  const knockable = snap.positions.filter((p) => p.data.fronted > 0n && now < p.data.lockAtSec && !snap.resolutions.has(p.data.termsCid));
  if (knockable.length > 0) counts.knocked = await knockOuts(d, knockable, () => writes++ < MAX_WRITES_PER_PASS);

  // ---- expire ---------------------------------------------------------------------------------------------
  const due = (validUntilSec: number) => now > validUntilSec + EXPIRE_SLACK_SEC;
  for (const q of snap.rangeQuotes) if (due(q.data.validUntilSec) && (await run(`texp:${q.cid}`, [tcmd.expireRangeQuote(q.cid)], "range quote expiry"))) counts.expired++;
  for (const q of snap.parlayQuotes) if (due(q.data.validUntilSec) && (await run(`texp:${q.cid}`, [tcmd.expireParlayQuote(q.cid)], "parlay quote expiry"))) counts.expired++;
  for (const q of snap.boostQuotes) if (due(q.data.validUntilSec) && (await run(`texp:${q.cid}`, [tcmd.expireBoostQuote(q.cid)], "boost quote expiry"))) counts.expired++;
  for (const q of snap.exitQuotes) if (due(q.data.validUntilSec) && (await run(`texp:${q.cid}`, [tcmd.expireBoostExit(q.cid)], "exit quote expiry"))) counts.expired++;
  for (const q of snap.supplyQuotes) if (due(q.data.validUntilSec) && (await run(`texp:${q.cid}`, [tcmd.expireSupplyQuote(q.cid)], "supply quote expiry"))) counts.expired++;
  for (const q of snap.withdrawQuotes) if (due(q.data.validUntilSec) && (await run(`texp:${q.cid}`, [tcmd.expireWithdrawQuote(q.cid)], "withdraw quote expiry"))) counts.expired++;

  // ---- prune, NAV and merge: on each reserve's own queue ------------------------------------------------------
  const fresh = writes > 0 ? await d.refresh() : snap;
  for (const reserve of TICKET_RESERVES) {
    await d.lock(reserve, async () => {
      const l = d.live.get(reserve)!;
      const book = fresh.books.get(reserve);
      const passed = book?.data.locked.filter(([t]) => t < now - 1) ?? [];
      if (book && l.bookCid === book.cid && passed.length > 0 && writes < MAX_WRITES_PER_PASS) {
        writes++;
        try {
          const out = await submit(d.venue, { commandId: `tprune:${digest(book.cid)}:${now - 1}`, commands: [tcmd.pruneBook(book.cid, now - 1)] });
          adoptCreated(d, reserve, out);
          counts.pruned += passed.length;
        } catch (error) {
          if (!isInactive(error)) d.log(`prune ${reserve} failed: ${failureText(error)}`);
        }
      }
      const nav = fresh.navs.get(reserve);
      if (nav && d.earnDeskCid && l.navCid === nav.cid) {
        const v = navInputsOf(fresh, reserve);
        const changed = v.assets !== nav.data.assets || v.shares !== nav.data.shares;
        if ((changed || now - nav.data.asOfSec >= NAV_EVERY_SEC) && now >= nav.data.asOfSec && writes < MAX_WRITES_PER_PASS) {
          writes++;
          try {
            const out = await submit(d.venue, { commandId: `tnav:${reserve}:${nav.data.seq}`, commands: [tcmd.publishNav(d.earnDeskCid, nav.cid, now, v.inputs)] });
            adoptCreated(d, reserve, out);
            counts.navs++;
            if (changed) notes.push(`${reserve} NAV ${nav.data.assets}/${nav.data.shares} → ${v.assets}/${v.shares}`);
          } catch (error) {
            // A ticket settled between the read and the publish: next pass counts it.
            if (!isInactive(error)) d.log(`nav ${reserve} failed: ${failureText(error)}`);
          }
        }
      }
      const pool = d.reservePools.get(reserve)!;
      const free = pool.all().filter((s) => s.state === "free");
      if (free.length > MERGE_ABOVE && writes < MAX_WRITES_PER_PASS) {
        const leases = pool.leaseWhere(() => true, 10, `merge ${reserve}`);
        const [head, ...rest] = leases;
        if (head && rest.length > 0) {
          writes++;
          try {
            await submitWithShards(pool, d.venue, leases, { commandId: `tmerge:${digest(...leases.map((x) => x.cid).sort())}`, commands: [cmd.mergeCash(head.cid, rest.map((x) => x.cid))] });
            counts.merged += leases.length;
          } catch (error) {
            d.log(`merge ${reserve} failed: ${failureText(error)}`);
          }
        } else pool.release(leases);
      }
    });
  }

  // What `/internal/tickets/state` serves is the last snapshot: after a publish it must be the new statement.
  if (counts.navs || counts.pruned || counts.merged) await d.refresh();
  const live = fresh.rounds.length + fresh.tickets.length + fresh.positions.length;
  const what = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`);
  return {
    why: `${live} live ticket(s)${what.length ? ` · ${what.join(", ")}` : ""}${notes.length ? ` · ${notes.join("; ")}` : ""}`,
    detail: { live, ...counts },
  };
}

/**
 * The Window's own rule for one boundary (the ledger's `PrintRule` in `Boost_KnockOut`): the oracles, bar, policy and
 * the close-admission window after the boundary. Quotes that count, first per oracle by fetch time.
 */
export function countedAt(terms: TermsC, boundarySec: number, quotes: readonly Active<PriceQuoteC>[]): Active<PriceQuoteC>[] {
  const admission = terms.closeDeadlineSec - terms.expirySec;
  const earliest = boundarySec + terms.minDelaySec;
  const deadline = boundarySec + admission;
  const valid = quotes
    .filter((q) => q.data.symbol === terms.symbol && q.data.boundarySec === boundarySec && terms.oracles.includes(q.data.oracle))
    .filter((q) => q.data.barLenSec === terms.barLenSec && q.data.policyVersion === terms.policyVersion)
    .filter((q) => q.data.fetchedAtSec >= earliest && q.data.fetchedAtSec <= deadline)
    .sort((a, b) => (a.data.oracle === b.data.oracle ? a.data.fetchedAtSec - b.data.fetchedAtSec || (a.data.priceE8 < b.data.priceE8 ? -1 : 1) : a.data.oracle < b.data.oracle ? -1 : 1));
  const out: Active<PriceQuoteC>[] = [];
  for (const q of valid) if (!out.some((o) => o.data.oracle === q.data.oracle)) out.push(q);
  return out;
}

/** Lower median and the deviation rule, as `medianOf` / `disagrees`. */
export function quorumPrint(qs: readonly Active<PriceQuoteC>[], maxDeviationBps: number): { median: bigint; disagrees: boolean } {
  const ps = qs.map((q) => q.data.priceE8).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = ps[Math.floor((ps.length - 1) / 2)]!;
  const hi = ps[ps.length - 1]!;
  const lo = ps[0]!;
  return { median, disagrees: (hi - lo) * 10_000n > BigInt(maxDeviationBps) * median };
}

export const beyondBarrier = (p: Pick<BoostPositionC, "side" | "barrierE8">, mark: bigint) => (p.side === "SideUp" ? mark <= p.barrierE8 : mark >= p.barrierE8);

async function knockOuts(d: Desk, positions: readonly Active<BoostPositionC>[], budget: () => boolean): Promise<number> {
  const acs = await readActive(d.venue, [TEMPLATE_IDS.MarketTerms, TEMPLATE_IDS.PriceQuote]);
  const terms = new Map(pick(acs, TEMPLATE_IDS.MarketTerms, decodeTerms).map((t) => [t.cid, t.data]));
  const quotes = pick(acs, TEMPLATE_IDS.PriceQuote, decodePriceQuote);
  let knocked = 0;
  for (const p of positions) {
    const t = terms.get(p.data.termsCid);
    if (!t) continue;
    // Boundaries of the position's life, before the Window's close, newest first.
    const boundaries = [...new Set(quotes.filter((q) => q.data.symbol === t.symbol).map((q) => q.data.boundarySec))]
      .filter((b) => b >= p.data.barrierFromSec && b < p.data.expirySec)
      .sort((a, b) => b - a);
    for (const b of boundaries) {
      const counted = countedAt(t, b, quotes);
      if (counted.length < t.quorum) continue;
      const { median, disagrees } = quorumPrint(counted, t.maxDeviationBps);
      if (disagrees || !beyondBarrier(p.data, median)) continue;
      if (!budget() || !d.venuePool) return knocked;
      let lease;
      try {
        lease = await d.venuePool.lease(p.data.knockOutProceeds, `knock-out ${p.data.marketId}`);
      } catch (error) {
        if (error instanceof PoolBusyError) return knocked;
        throw error;
      }
      try {
        await submitWithShards(d.venuePool, d.venue, [lease], {
          commandId: `tko:${p.cid}`,
          commands: [tcmd.knockOutBoost(p.cid, { observedAtSec: b, quoteCids: counted.map((q) => q.cid), shardCid: lease.cid })],
        });
        knocked++;
        d.log(`knocked out ${p.data.marketId} ${p.data.side} at ${median} (barrier ${p.data.barrierE8}, boundary ${new Date(b * 1000).toISOString()}, ${counted.length} oracles)`);
      } catch (error) {
        if (!isInactive(error)) d.log(`knock-out ${p.data.marketId} failed: ${failureText(error)}`);
      }
      break;
    }
  }
  return knocked;
}

export type { DeskSnapshot };
