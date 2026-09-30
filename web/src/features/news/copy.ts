import type { Sentiment } from "./protocol";

/** `/news` — the reference's own deleted page (`app/news/page.tsx` at 93d09c1^) and `NewsFeed.tsx`. */
export const NEWS = {
  title: "News",
  live: "Updated live",
  /** "Bitcoin News" in the reference; the venue here lists more than one asset, and `?symbol=` names the one. */
  heading: "Market",
  headingAccent: "News",
  /** Verbatim from the reference — "headlines that move the market". */
  headingJp: "市場を動かす見出し。",
  /** The reference's line, plus the provider credit (Q-S13-6: the Finnhub free tier, credited). */
  intro: "Sentiment-tagged and refreshed live. Read the room before you ring the bell. Headlines via Finnhub.",
  quiet: "The wire is quiet. Headlines return shortly.",
  sentiment: { positive: "bullish", negative: "bearish", neutral: "neutral" } satisfies Record<Sentiment, string>,
  /**
   * The marquee's crowd cell, on hover (plan: `/api/sentiment` "with the privacy note on hover", C13a): what it counts,
   * and what it never counts.
   */
  crowdPrivacy:
    "Crowd flow: the Up share of calls people chose to publish in the last hour. Shown only when at least 5 people published; calls kept private are never counted.",
  /** "now", "5m", "2h", "3d" — the reference's `timeAgo`. */
  timeAgo: (ms: number): string => {
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  },
} as const;
