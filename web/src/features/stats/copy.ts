/** `/stats` — the reference's `app/stats/page.tsx` words, truth-corrected: no gas sponsor exists here, the fill tape is the proof. */
export const STATS = {
  title: "Traction",
  hero: {
    eyebrow: "Live · on the ledger · verifiable",
    titleLead: "Proof of",
    titleAccent: "demand",
    lede: "Real calls, read from the ledger. Every call here is a published Canton contract signed by its owner and the venue, so the ledger itself proves each one: not a form we filled in. Only calls their owners chose to publish are counted.",
    headline: "Wallets that made a call · 24h",
    headlineCaption: "took a side on a live Window and published it",
    headlineFoot: "Calls filled",
  },
  reading: "reading the ledger…",
  unreachable: "couldn't reach the venue's projection, retrying…",
  sections: {
    growth: { index: "01", title: "Growth", tag: "cumulative · who showed up · last 24 hours" },
    adoption: { index: "02", title: "Adoption", tag: "real wallets · attributable" },
    activity: { index: "03", title: "Live activity", tag: "published calls only · click any row → its ledger update" },
  },
  curve: {
    empty: "your growth curve starts with the first call. Drive one and watch it climb.",
    axis: "CUMULATIVE WALLETS THAT MADE A CALL · BY HOUR",
  },
  stats: {
    wallets: { label: "Seats that published a call", sub: "took a side on a live Window and published it" },
    calls: { label: "Published calls", sub: "accepted venue quotes, opted in" },
    staked: { label: "Staked", onLine: (symbol: string) => `${symbol} placed on the line`, floor: (symbol: string) => `${symbol} · at least this much` },
    settled: { label: "Windows settled", sub: (closed: number) => `of ${closed} that closed` },
  },
  attribution: (unattributed: number) =>
    unattributed > 0
      ? `Every call here is a published Publication contract: an accepted venue quote its owner chose to show. ${unattributed} ${unattributed === 1 ? "call sat" : "calls sat"} on a Window the projection had not fully read at this read and ${unattributed === 1 ? "is" : "are"} not counted.`
      : "Every call here is a published Publication contract: an accepted venue quote its owner chose to show. Nothing is self-reported, and a call nobody published is never counted.",
  floor: "A paging cap cut this read short, so every figure is a floor, not a total.",
  activity: {
    empty: "no activity indexed yet",
    updated: (ago: string) => `updated ${ago}`,
    kind: { call: "call", "cash-out": "cash-out" },
  },
  foot: "Adoption reads the published calls on every Window that closed in the last 24 hours: the same replay the leaderboard ranks, computed once and shared. Only calls their owners chose to publish; everyone else's trading stays private to them and the venue. Demo cash on a Canton test network.",
  errors: { compute: "Traction could not be computed right now." },
  /** C5: the venue's own totals (k-floored) and the auditor's view: what the venue holds against what it owes. */
  venue: {
    section: { index: "04", title: "Venue totals", tag: "the venue's view · Windows with 5+ traders only" },
    windows: { label: "Windows closed · 24h", sub: (resolved: number, voided: number) => `${resolved} resolved · ${voided} void` },
    trades: { label: "Trades", sub: (n: number) => `on ${n} Window${n === 1 ? "" : "s"} with 5+ traders` },
    volume: { label: "Staked", sub: (symbol: string) => `${symbol} by traders on those Windows` },
    fees: { label: "Fees earned", sub: "recognised at settlement, never on a void" },
    withheld: (n: number, floor: number) =>
      n > 0
        ? `${n} Window${n === 1 ? "" : "s"} had fewer than ${floor} traders, so ${n === 1 ? "its" : "their"} figures are left out: a total never describes one or two people.`
        : `Every traded Window here had at least ${floor} traders.`,
    unavailable: "The venue's projection is not reachable, so its totals cannot be shown.",
  },
  audit: {
    section: { index: "05", title: "Auditor view", tag: "reserve · independent recount" },
    free: { label: "Free cash", sub: "the venue's trading cash" },
    locked: { label: "Locked in quotes", sub: (n: number) => `${n} live quote${n === 1 ? "" : "s"}` },
    backing: { label: "Leg backing", sub: "venue legs + users' stakes and fees" },
    owed: { label: "Most it can owe", sub: (n: number) => `every user leg winning · ${n} open leg${n === 1 ? "" : "s"}` },
    headroom: (v: string, symbol: string, asOf: string) => `Headroom ${v} ${symbol}: held minus the most owed, as of ${asOf}. Never negative on a solvent venue.`,
    reserveDown: (why: string) => `Reserve snapshot unavailable: ${why}.`,
    recountTitle: "Independent recount",
    recountNone: "No recount recorded yet. Run scripts/drive/recount.ts to add one.",
    recountHead: (ok: boolean, offset: string, at: string) => `${ok ? "Agrees" : "Differs"} at ledger offset ${offset} · ${at}`,
    recountTemplate: (t: string, ledger: number, projection: number) => `${t}: ledger ${ledger} · projection ${projection}`,
    recountReserve: (matches: boolean) => (matches ? "Reserve recomputed from the ledger matches the projection's legs and quotes." : "Reserve recomputed from the ledger differs from the projection."),
    recountReporter: (same: boolean, at: string) => `Against the reserve reporter's snapshot of ${at}: ${same ? "the same figures" : "the figures moved between the two reads"}.`,
    explain:
      "The recount re-reads the venue's active contracts straight from the ledger at the projection's offset and compares them contract by contract with the rows every page here is built from, then recomputes the reserve from those contracts. On a demo network the venue mints its own cash, so solvency is a claim this view lets anyone check.",
  },
} as const;

/** The reference's `ago()`, verbatim. */
export function ago(ts: number, nowMs: number): string {
  if (!ts) return "";
  const s = Math.floor((nowMs - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** The reference's `fmt()`: whole numbers past 100, two decimals under. */
export const fmtCount = (n: number): string => n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 });
