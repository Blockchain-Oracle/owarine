import { ADVICE_COPY } from "@owarine/core/copy";

/**
 * `/` — the landing's words. Session words and lane words come from core and
 * `copy-session.ts`; this file adds the sentences around them.
 */
export const LANDING = {
  meta: {
    title: "Owarine · Private prediction markets on Canton",
    description: "Call the close on Bitcoin, Tesla, OpenAI or Canton Coin, a few minutes at a time. Watch your PnL live and close in one tap. Your position is a private contract on Canton: only you and the venue can see it.",
  },
  /**
   * S25: the band under the hero, one column for each original source the venue's Windows have closed on (the index's
   * print mix, so a source appears when a Window settles on it). Each source goes by its plain name; `how` is what the
   * oracle parties read from it, and every price is signed by them before the print is recorded.
   */
  builtOn: {
    label: "Built on",
    reading: "Counting settled Windows…",
    unread: "The index is not answering; the count returns when it does.",
    none: "No Window has settled yet.",
    proof: "Latest print proof →",
    figure: "Windows settled",
    signed: "read by the venue's oracle parties and signed before the print is recorded",
    sources: {
      exchanges: { name: "Coinbase, Kraken and Bitstamp", how: "One-minute candle closes from the three exchanges" },
      redstone: { name: "RedStone", how: "RedStone's primary data feed" },
      alpaca: { name: "Alpaca", how: "The last IEX trade, from Alpaca market data" },
      jupiter: { name: "Jupiter Price v3", how: "The median of three samples taken around the close" },
      prestocks: { name: "PreStocks", how: "PreStocks catalogue prices" },
      pyth: { name: "Pyth", how: "Pyth prices" },
      switchboard: { name: "Switchboard", how: "Switchboard Surge prices" },
    },
    what: (names: string, how: string, signed: string, baskets: number) => {
      const groups = baskets > 0 ? `${baskets} basket${baskets === 1 ? "" : "s"}` : "";
      return `${[names, groups].filter(Boolean).join(" and ")}. ${how}, ${signed}.`;
    },
  },
  proof: {
    section: { index: "06", title: "Proof", desc: "Every party below opens its own page, and every settled Window opens on the proof page." },
    program: "Package",
    venue: "Venue config",
    clusterLabel: "Network",
    cluster: "Canton test network",
    settled: "Last settled Windows",
    reading: "Reading the index…",
    none: "No settled Window indexed yet. The first one lands at the next close.",
    outcome: { up: "Up won", down: "Down won", void: "Void" },
    closed: (when: string) => `closed ${when} ET`,
    explorer: "Proof",
    explorerAria: (what: string) => `Open ${what}`,
    printProof: "Print proof",
    unset: "not configured",
  },
} as const;

/**
 * The "not investment advice" line (`ADVICE_COPY.notAdvice`, lane 15d), wired into the landing footer at the S15 merge.
 * Null would hide the footer's advice paragraph.
 */
export const LANDING_ADVICE_SLOT: string | null = ADVICE_COPY.notAdvice;
