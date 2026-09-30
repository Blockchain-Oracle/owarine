/**
 * The maker vault's Windows in the reference's `WindowBook` terms, from the ledger's own contracts (abu-pm-main 0.5.0).
 * Pure. What each figure is on Canton, stated rather than invented (D-015):
 *
 *   escrowOutBase    what the book put up on the Window: the locks of its open quotes and buy-backs, what it paid
 *                    for every position it holds, and the cost its receipts recorded for every position it closed
 *   escrowBackBase   0: an unaccepted quote's lock goes straight back to the reserve bucket and is not counted out
 *   mergedBase       what its merges released into the bucket (`BookReceipt` "merged")
 *   payoutBase       what its settles and residuals paid into the bucket ("settled", "residual")
 *   deployedBase     today's mark of what is still out (the statement's rule)
 *   quoteCount       quotes resting plus positions taken (a merge closes two)
 *   openedAtSec / settledAtSec   not on the ledger: 0 / null
 *   realizedBase     once nothing of the book's is left on the Window: merged + payout − escrowOut
 */
import type { Active, LegC } from "../canton/decode";
import type { BookReceiptC } from "../canton/decode-book";
import { legMark, paidFor, quoteLockOf, residualMark, type MakerSnapshot } from "./nav";

export interface BookWindow {
  /** The Daml market id (`MarketTerms.marketId`). */
  marketId: string;
  expirySec: number | null;
  escrowOutBase: bigint;
  escrowBackBase: bigint;
  mergedBase: bigint;
  payoutBase: bigint;
  quoteCount: number;
  settled: boolean;
  yesRaw: bigint;
  noRaw: bigint;
  deployedBase: bigint;
  realizedBase: bigint | null;
  /** The Window has a Resolution the book's legs or residuals can settle against now. */
  settleable: boolean;
  /** The book holds both sides here, so a merge would release cash now. */
  mergeable: boolean;
}

const sum = (xs: readonly bigint[]) => xs.reduce((a, b) => a + b, 0n);
const quantityOf = (l: LegC) => l.lots * 1000n * l.cashUnit;

/** Every Window the book is on or was on, split into open (something of the book's is still there) and history. */
export function bookWindows(s: MakerSnapshot, asOfSec: number): { open: BookWindow[]; history: BookWindow[] } {
  const byMarket = new Map<string, { quotes: bigint[]; count: number; legs: Active<LegC>[]; residuals: bigint[]; receipts: BookReceiptC[]; terms: Set<string> }>();
  const at = (marketId: string) => {
    let m = byMarket.get(marketId);
    if (!m) byMarket.set(marketId, (m = { quotes: [], count: 0, legs: [], residuals: [], receipts: [], terms: new Set() }));
    return m;
  };
  const res = (termsCid: string) => s.resolutions.get(termsCid)?.data ?? null;
  const markets = s.markets;
  for (const q of s.quotes) {
    const m = at(q.data.marketId);
    m.quotes.push(quoteLockOf(q.data));
    m.count++;
    m.terms.add(q.data.termsCid);
  }
  for (const b of s.buyQuotes) {
    const marketId = markets.get(b.data.termsCid)?.marketId;
    if (!marketId) continue;
    const m = at(marketId);
    m.quotes.push(b.data.locked);
    m.count++;
    m.terms.add(b.data.termsCid);
  }
  for (const l of s.legs) {
    const m = at(l.data.marketId);
    m.legs.push(l);
    m.count++;
    m.terms.add(l.data.termsCid);
  }
  for (const x of s.residuals) {
    const m = at(x.data.marketId);
    m.residuals.push(residualMark(x.data, res(x.data.termsCid)));
    m.terms.add(x.data.termsCid);
  }
  for (const r of s.receipts) {
    const m = at(r.data.marketId);
    m.receipts.push(r.data);
    m.count += r.data.kind === "merged" ? 2 : r.data.kind === "settled" ? 1 : 0;
  }
  const expiryOf = (marketId: string, terms: ReadonlySet<string>) => {
    for (const t of terms) {
      const e = markets.get(t)?.expirySec;
      if (e !== undefined) return e;
    }
    for (const info of markets.values()) if (info.marketId === marketId) return info.expirySec;
    return null;
  };

  const open: BookWindow[] = [];
  const history: BookWindow[] = [];
  for (const [marketId, m] of byMarket) {
    const legMarks = m.legs.map((l) => legMark(l.data, asOfSec, res(l.data.termsCid), markets.get(l.data.termsCid)?.expirySec ?? null));
    const cost = sum(m.receipts.map((r) => r.cost));
    const merged = sum(m.receipts.filter((r) => r.kind === "merged").map((r) => r.proceeds));
    const payout = sum(m.receipts.filter((r) => r.kind !== "merged").map((r) => r.proceeds));
    const escrowOut = sum(m.quotes) + sum(m.legs.map((l) => paidFor(l.data))) + cost;
    const still = m.quotes.length > 0 || m.legs.length > 0 || m.residuals.length > 0;
    const settled = !still && m.receipts.length > 0;
    const up = m.legs.filter((l) => l.data.outcome === "SideUp");
    const down = m.legs.filter((l) => l.data.outcome === "SideDown");
    const view: BookWindow = {
      marketId,
      expirySec: expiryOf(marketId, m.terms),
      escrowOutBase: escrowOut,
      escrowBackBase: 0n,
      mergedBase: merged,
      payoutBase: payout,
      quoteCount: m.count,
      settled,
      yesRaw: sum(up.map((l) => quantityOf(l.data))),
      noRaw: sum(down.map((l) => quantityOf(l.data))),
      deployedBase: sum(m.quotes) + sum(legMarks) + sum(m.residuals),
      realizedBase: settled ? merged + payout - escrowOut : null,
      settleable: (m.legs.length > 0 || m.residuals.length > 0) && [...m.terms].some((t) => res(t) !== null),
      mergeable: up.length > 0 && down.length > 0,
    };
    (still ? open : history).push(view);
  }
  const byExpiry = (a: BookWindow, b: BookWindow) => (a.expirySec ?? 0) - (b.expirySec ?? 0);
  open.sort(byExpiry);
  history.sort((a, b) => byExpiry(b, a));
  return { open, history };
}

/** The first Window whose Resolution is in and whose book positions are still unsettled: what a withdrawal settles first. */
export function unsettledExpired(open: readonly BookWindow[], nowSec: number): string | null {
  return open.find((w) => w.settleable && w.expirySec !== null && w.expirySec <= nowSec)?.marketId ?? null;
}
