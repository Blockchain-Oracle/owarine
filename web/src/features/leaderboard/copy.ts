import type { BoardPeriod } from "./protocol";

/** What a board covers, in words: the rolling day, today's session (so far or whole), or an earlier session by date. */
export interface BoardSpan {
  period: BoardPeriod;
  /** The session's ET date (`YYYY-MM-DD`), null on the 24 h board. */
  sessionDate: string | null;
  /** The session is today's (ET). */
  today: boolean;
  /** The scan ended before the session's last Windows settled. */
  live: boolean;
}

const dateLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};

/** An earlier session, by its date; null for the 24 h board, today's session, or a session not answered yet. */
const pastDate = (span: BoardSpan): string | null => (span.period === "session" && span.sessionDate !== null && !span.today ? dateLabel(span.sessionDate) : null);

/** "the last 24 hours", "this session", "the Mon, Sep 14 session". */
function spanWords(span: BoardSpan): string {
  if (span.period === "24h") return "the last 24 hours";
  if (span.period === "7d") return "the last 7 days";
  if (span.period === "30d") return "the last 30 days";
  if (span.period === "all") return "all time";
  const date = pastDate(span);
  return date ? `the ${date} session` : "this session";
}

function coverage(span: BoardSpan, complete: boolean): string {
  if (span.period === "24h") return complete ? "full day" : "partial day";
  if (span.period !== "session") return complete ? "complete" : "partial";
  if (!complete) return "partial session";
  return span.live ? "session so far" : "full session";
}

/** `/leaderboard` — ported from the reference's leaderboard page; facts adapted to Owarine's sessions and tickers. */
export const LEADERBOARD = {
  title: "Leaderboard",
  hero: {
    eyebrow: "Published trading records",
    title: ["The", "house", "of names."] as const,
    traders: (period: BoardPeriod) => `Ranked traders · ${period === "session" ? "session" : period === "all" ? "all time" : period}`,
    staked: "Total staked · top 50",
    nextClose: "Next market closes in",
    stamp: (period: BoardPeriod) => ({ session: "SESSION BOARD", "24h": "LAST 24 HOURS", "7d": "THIS WEEK", "30d": "THIS MONTH", all: "ALL TIME" })[period],
    stampSub: (span: BoardSpan) => (span.period === "all" ? "SINCE LAUNCH" : span.period !== "session" ? "ROLLING" : span.sessionDate === null ? "—" : dateLabel(span.sessionDate).toUpperCase()),
    periods: { session: "NYSE session", "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" } as Record<BoardPeriod, string>,
    periodGroup: "Board period",
    closedCalls: (n: number, span: BoardSpan, complete: boolean, ticker: string | null) =>
      `${n.toLocaleString()} closed calls${ticker ? ` · ${ticker}` : ""} · ${coverage(span, complete)}`,
    counting: "counting recent closes",
  },
  loading: "Reading published calls from the ledger…",
  refreshing: "Showing the last computed board while rankings refresh.",
  refreshFailed: "The update could not be read. These are the last computed rankings; we'll retry automatically.",
  updated: (atMs: number) => `Computed ${new Date(atMs).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  empty: {
    headline: "No settled published calls in this window.",
    body: "Share a call from Portfolio to join the public board. It ranks once settled; your own trades are always in Your activity. Try Last 24 hours or All time for a wider view.",
  },
  failed: "The board is taking longer than expected. We'll check again automatically.",
  retry: "Try again",
  podium: {
    number: "01",
    title: "The podium",
    desc: (span: BoardSpan) => `The top three on Owarine by profit over ${spanWords(span)}, using their published calls.`,
    ordinals: { 1: "1ST", 2: "2ND", 3: "3RD" } as Record<1 | 2 | 3, string>,
    sash: "GRAND CHAMPION",
    streak: (n: number) => `${n} WIN STREAK`,
    challenger: "CHALLENGER",
    contender: "CONTENDER",
  },
  field: {
    number: "02",
    title: "The field",
    desc: "Ranks four onward, ordered by profit.",
    meta: (span: BoardSpan) => spanWords(span),
    strip: {
      ranks: "RANKS 04-50",
      center: (span: BoardSpan) => `${spanWords(span).toUpperCase()} · PROFIT`,
      right: "CLOSED CALLS",
    },
    heads: { east: "Ranked account", center: "RANKS", west: "Ranked account" },
    dividers: { rankAndFile: "RANK & FILE", longTail: "THE LONG TAIL" },
    cellMeta: (rank: number, calls: number, winRate: number) => `#${rank} · ${calls} calls · ${winRate}% wins`,
  },
  /** Masayume's "Live activity" (`/stats`), under the board. */
  activity: {
    number: "03",
    title: "Public activity",
    desc: "Public calls and cash-outs from the last 24 hours. Publishing shares a call here; your personal Activity includes unpublished trades too.",
    updated: (ago: string) => `updated ${ago}`,
    reading: "reading the chain…",
    unreachable: "couldn't reach the chain, retrying…",
  },
  you: {
    rank: "Your rank",
    unranked: "Unranked",
    of: (n: string) => `of ${n} on the venue`,
    name: (short: string) => `You · ${short}`,
    top: (pct: number) => `top ${pct}%`,
    none: (span: BoardSpan) => `not in the public top 50 for ${spanWords(span)}`,
    net: "Net",
    winRate: "Win rate",
    streak: "Streak",
    cta: "Your portfolio →",
    activity: "Your activity →",
  },
  dash: "—",
  errors: { compute: "The board could not be computed." },
} as const;
