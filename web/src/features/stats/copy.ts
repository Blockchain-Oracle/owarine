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
