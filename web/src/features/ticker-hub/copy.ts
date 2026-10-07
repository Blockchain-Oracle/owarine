import type { Ticker, TickerSymbol } from "@owarine/core/market";

/**
 * `/tickers/[SYMBOL]` — one stock's square: its price and session, its next report, its Room, what traders called on
 * its Windows, and its headlines. Masayume has no ticker page; the frame is `/news`'s and every list is its wire.
 */
export const TICKER_HUB = {
  title: (symbol: TickerSymbol, name: string) => `${name} (${symbol})`,
  alwaysOpen: "Trading 24/7",
  eyebrow: (kind: Ticker["kind"]) => (kind === "etf" ? "ETF" : kind === "preIpo" ? "Pre-IPO" : kind === "basket" ? "Basket" : kind === "valuation" ? "Valuation" : kind === "crypto" ? "Crypto" : "Stock"),
  headingJp: "銘柄の広場。",
  intro: (name: string) => `Everything Owarine knows about ${name} in one place: the live print, the session, the next report, and every call on its Windows.`,
  /** C9e: a coin trades around the clock and files no reports: no session and no report date are promised. */
  introCrypto: (name: string) => `Everything Owarine knows about ${name} in one place: the live print, around the clock, and every call on its Windows.`,
  spot: "Spot",
  spotStale: "last print",
  earnings: "Next report",
  earningsNone: "none scheduled",
  earningsUnknown: "—",
  hour: { bmo: "before open", amc: "after close", dmh: "during hours" } as const,
  cadences: "Windows",
  dash: "—",
  trade: "Trade it →",

  /** A pre-IPO name (D-100): no report date exists, so the bar shows what only PreStocks has, and Pyth's valuation index where the venue may read it (S20). */
  preIpo: {
    intro: (name: string) => `Everything Owarine knows about ${name} in one place: the PreStocks token price, the SPV's own valuation, how far apart the two sit, and every call on its Windows.`,
    introBoth: (name: string) => `Everything Owarine knows about ${name} in one place: the PreStocks token price, the SPV's own valuation, Pyth's valuation index, how far apart they sit, and every call on its Windows.`,
    tokenPrice: "Token price",
    mark: "PreStocks mark",
    markHint: "PreStocks' valuation of the company per token",
    index: "Pyth index",
    indexHint: "Pyth's valuation index for the company, per token",
    premium: "Token vs mark",
    indexPremium: "Token vs Pyth",
    premiumLine: (bps: number) => `${bps >= 0 ? "+" : "−"}${(Math.abs(bps) / 100).toFixed(1)}% ${bps >= 0 ? "above" : "below"}`,
    holders: "Holders",
    holdersLine: (now: number, monthAgo: number | null) => (monthAgo === null ? now.toLocaleString("en-US") : `${now.toLocaleString("en-US")} (${now >= monthAgo ? "+" : "−"}${Math.abs(now - monthAgo).toLocaleString("en-US")} in 4 wk)`),
    /** After the PreStocks source line under the bar: the token lane alone, or the token lane beside the valuation lane's Pyth index. */
    sourcePreStocksOnly: "single source, attested by three oracle parties · no cross-check",
    sourceBoth: "token lane attested by three oracle parties, no cross-check · valuation lane settles on Pyth's index",
    /** C8d: the index rows are left out, and the bar says why (never a silent gap). */
    indexAbsent: (why: string) => `Pyth's valuation index is not shown: ${why}.`,
  },

  /**
   * A valuation lane (S20, D-125, C8d): it settles on Pyth's valuation index of a company, not on the token. It is
   * listed only while ops' hourly probe says the venue's key may read the index; until then its hub says why.
   */
  valuation: {
    gate: "a Pyth key entitled to the pyth-indices group",
    why: {
      denied: (status: number | null, group: string | null, at: string | null) =>
        `the venue's Pyth key may not read it (Hermes answered ${status ?? "a refusal"}${group ? `, group ${group}` : ""}${at ? `, checked ${at} UTC` : ""})`,
      noKey: "no Pyth key is set on this venue",
      unknown: "the venue has had no answer from Pyth yet",
      noPrint: "the index has not printed since the key was entitled",
      readFailed: "the venue's index read failed just now",
    },
    intro: (name: string, company: string) => `${name} settles on Pyth's valuation index of ${company}, not on the PreStocks token price. The bar puts the index beside the token, and how far apart the two sit.`,
    introAbsent: (name: string, company: string) => `${name} would settle on Pyth's valuation index of ${company}, not on the PreStocks token price.`,
    notListed: "Not listed",
    laneEyebrow: "Valuation lane",
    pendingTitle: (name: string) => `${name} is not listed`,
    pendingBody: (why: string) => `No Window opens on this lane until the venue may read the index, so no dead lane is ever shown. Right now ${why}.`,
    tokenHub: (company: string) => `See the ${company} token`,
    index: "Pyth index",
    indexHint: "Pyth's valuation index for the company, per token",
    token: "Token price",
    tokenVsIndex: "Token vs Pyth",
    age: "Index age",
    ageLine: (sec: number) => (sec < 120 ? `${sec} s` : `${Math.round(sec / 60)} min`),
    window: { title: "Live Window", none: "No valuation Window is trading right now. One opens every hour on the 24/7 lane while the index is readable." },
    source: "the index read off-chain and attested by three oracle parties · single source",
  },

  /** `/dev/pyth-index`: the pre-IPO hub's bar with and without the Pyth rows (S20). */
  dev: {
    title: "Pre-IPO hub · Pyth valuation index",
    intro: "The OpenAI hub's figure bar and the OpenAI valuation lane's hub from canned readings: as they show today, with the venue's key refused the index (the bar says why, the lane is not listed), and as they show once a key that may read the index answers. Nothing here is a live read.",
    withoutIndex: "Without the index — the key is not entitled (today)",
    withIndex: "With the index — the key is entitled",
    valuationAbsent: "Valuation hub ($OPENAIV) — not listed, the key is refused (today)",
    valuationListed: "Valuation hub ($OPENAIV) — listed, the index beside the token",
  },

  /** A basket (S19, D-124): a small group of companies bet on together; its bar shows the index, not a price. */
  basket: {
    intro: (name: string, members: string) => `${name} is a basket: a small group of companies bet on together. ${members}, weighted equally, read from PreStocks in one go and scored as an index that started at 1,000 points.`,
    index: "Index",
    indexHint: "1,000 points at the base prices, frozen when the basket was listed",
    members: "Members",
    membersLine: (count: number) => `${count} · equal weight`,
    moved: (window: string) => `Moved ${window}`,
    movedLine: (rangePct: string, change: string) => `${rangePct} high to low · ${change} first to last`,
    quiet: "not enough reads yet",
    table: { title: "Members", member: "Company", weight: "Weight", price: "Token price", sinceBase: "Since base", held: "You hold", yes: "yes", no: "—" },
    window: { title: "Live Window", none: "No basket Window is trading right now. One opens every hour on the 24/7 lane once the Series is listed." },
    hold: {
      connect: "Take a seat to see which members you hold.",
      none: (total: number) => `You hold none of the ${total} members.`,
      some: (held: number, total: number, value: string | null) => `You hold ${held} of ${total} members${value ? ` ≈ ${value}` : ""}.`,
      coverNeeds: "Cover needs two or more members held; one member is covered on its own name.",
      cover: "Cover the basket with Down",
      add: "Add with Up",
      noWindow: "Cover and Add open when a basket Window is trading.",
    },
    /** After the basket's source line ("Index of 2 PreStocks prices"). */
    source: "computed from one read of every member and attested by three oracle parties · single source, no cross-check",
  },

  feed: { number: "01", title: "Calls", desc: "Fills on this ticker's Windows, the verdicts of the traders who made them, and takes tagged with its cashtag." },
  news: { number: "02", title: "Headlines", desc: "Stories about this company, newest first.", descCrypto: (name: string) => `Stories about ${name}, newest first.`, credit: "Headlines via Finnhub" },
  board: {
    number: "03",
    title: "Board",
    desc: "The traders with the best record on this ticker.",
    pending: "The per-ticker board arrives with the leaderboard's ticker tabs. Until then, the full board ranks everyone.",
    link: "Open the leaderboard →",
  },
} as const;
