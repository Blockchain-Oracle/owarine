/** `/stats` — the reference's `app/stats/page.tsx` words, truth-corrected: no network fee on Canton, the ledger is the proof. */
export const STATS = {
  title: "Traction",
  hero: {
    eyebrow: "Live · on the ledger · verifiable",
    titleLead: "Proof of",
    titleAccent: "demand",
    lede: "Real seats, read straight from the venue's view of the ledger. Every call is a fill against the venue's quote, so the ledger itself proves each one — not a form we filled in. Every settlement opens on the proof page.",
    headline: "Seats that made a call · 24h",
    headlineCaption: "took a side on a live Window · read off the ledger",
    headlineFoot: "Calls filled",
  },
  reading: "reading the ledger…",
  unreachable: "couldn't reach the ledger, retrying…",
  sections: {
    growth: { index: "01", title: "Growth", tag: "cumulative · who showed up · last 24 hours" },
    adoption: { index: "02", title: "Adoption", tag: "real seats · attributable" },
    activity: { index: "03", title: "Live activity", tag: "click any row → the proof page" },
  },
  curve: {
    empty: "your growth curve starts with the first call. Drive one and watch it climb.",
    axis: "CUMULATIVE SEATS THAT MADE A CALL · BY HOUR",
  },
  stats: {
    wallets: { label: "Seats that made a call", sub: "took a side on a live Window" },
    calls: { label: "Calls filled", sub: "quotes taken from the venue" },
    staked: { label: "Staked", onLine: (symbol: string) => `${symbol} placed on the line`, floor: (symbol: string) => `${symbol} · at least this much` },
    settled: { label: "Windows settled", sub: (closed: number) => `of ${closed} that closed` },
  },
  attribution: (unattributed: number) =>
    unattributed > 0
      ? `Every call here is a quote a seat took from the venue; the venue's own parties are left out. ${unattributed} ${unattributed === 1 ? "fill sat" : "fills sat"} on a Window the indexer had not fully read at this read and ${unattributed === 1 ? "is" : "are"} not counted.`
      : "Every call here is a quote a seat took from the venue; the venue's own parties are left out. Nothing is self-reported and nothing is inferred from a form.",
  floor: "A paging cap cut this read short, so every figure is a floor, not a total.",
  activity: {
    empty: "no activity indexed yet",
    updated: (ago: string) => `updated ${ago}`,
    kind: { call: "call", "cash-out": "cash-out" },
  },
  foot: "Adoption reads the Agari projector's fills for every Window that closed in the last 24 hours — the same replay the leaderboard ranks, computed once and shared. A Canton test network today, so it is demo credits only. The same surface carries to real money when the Canton Coin rail lands.",
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
