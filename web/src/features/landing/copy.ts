import { ADVICE_COPY } from "@agari/core/copy";

/**
 * `/` — the landing's words. Session words and lane words come from core and
 * `copy-session.ts`; this file adds the sentences around them.
 */
export const LANDING = {
  meta: {
    title: "Agari · Stock prediction markets on Canton",
    description: "Predict whether a stock price will rise or fall, and inspect the signed price print behind every settlement on the proof page. Canton test network, demo credits.",
  },
  hero: {
    eyebrow: "Canton prediction markets",
    titleLead: "Predict stock",
    titleEm: "price moves.",
    line: "Choose a stock. Predict whether its price will rise or fall. See the price print that settled the market.",
    primary: "Open markets",
    secondary: "How it works",
    docs: "Read the docs →",
    paths: "Predict  ·  Cover  ·  Hold",
    folioLeft: "Agari / Prediction exchange",
    folioRight: "Canton prediction markets",
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
  steps: {
    section: { index: "01", title: "A call in three steps", desc: "No chart to read. One question, one clock, one print." },
    items: [
      {
        kicker: "Pick",
        title: "Pick a Window",
        body: "A Window is a question with a clock: will the stock close higher than it opened, five, fifteen or sixty minutes from now?",
        art: [{ word: "5m" }, { word: "15m" }, { word: "1h" }],
      },
      {
        kicker: "Call",
        title: "Make the call",
        body: "Up or Down, and a stake in demo credits. The price is a firm quote from the venue, and your seat takes it.",
        art: [{ word: "Up", tone: "up" }, { word: "Down", tone: "down" }],
      },
      {
        kicker: "Settle",
        title: "See it settle",
        body: "At the close the oracle parties sign the print and the resolver checks it against the open. The receipt links to both.",
        art: [{ word: "open print" }, { word: "close print" }, { word: "settled", tone: "accent" }],
      },
    ],
  },
  lanes: {
    section: { index: "02", title: "Three lanes", desc: "Each lane runs on its own clock." },
    reading: "Reading the session…",
    unknown: "The session is unreachable. The lanes list again when it answers.",
    notListed: "Not listed on the test network yet.",
    names: (n: number) => `${n} name${n === 1 ? "" : "s"}`,
    regular: {
      name: "Regular",
      clock: "5m · 15m · 1h on the NYSE clock",
      body: "Windows roll through the regular session, 09:30 to 16:00 ET, back to back.",
      open: (span: string) => `Open now · closes in ${span}`,
      first: (cadence: string, when: string) => `${cadence} from ${when}`,
    },
    gap: {
      name: "Gap",
      clock: "Friday close → Monday open",
      body: "One Window across the weekend: does Monday open above Friday's close?",
      next: (close: string, open: string) => `Next ${close} → ${open}`,
    },
    token: {
      name: "Token",
      clock: "24/7",
      body: "Tokenized shares trade through nights and weekends, so these Windows never wait for the bell.",
      open: (cadences: string) => `Open now · ${cadences}`,
    },
  },
  /** Plan Step 6 (D-100): the case for covering a stock token you already own, in plain words, beside the card itself. */
  cover: {
    section: { index: "03", title: "Cover what you hold", desc: "Own a stock token? Protect it without selling it." },
    paragraphs: [
      "Tokenized stocks trade around the clock on other networks: Tesla and Nvidia as xStocks, and private companies like OpenAI, Anthropic and SpaceX as PreStocks. Until now, a holder who feared a drop had two choices: sell, or hope.",
      "Agari adds a third: a Down bet on that name as cover. A seat holds no outside tokens until the Canton Coin rail lands, so today this shows how cover works. If the price falls, the bet pays and softens the loss. If it rises, the bet costs a little and the tokens are worth more.",
      "Hold two or more of the same basket, a small group of companies bet on together such as OpenAI and Anthropic, and one Down bet on the basket covers them at once.",
    ],
    story: "In May 2026 the OpenAI token fell 39% in a week after OpenAI and Anthropic disputed the tokens, and there was too little liquidity for everyone to sell. A holder with a Down bet would have been paid as it fell.",
    note: "On the Canton test network with demo credits, so this shows how the cover works rather than protecting real money. Not investment advice. Every token you hold is listed on your",
    portfolio: "Portfolio page →",
    cta: "See it on Markets",
  },
  /** S21 (plan §5.2): the desk, the one place real money moves, in plain words beside its promise. */
  desk: {
    section: { index: "04", title: "Let a desk hold it", desc: "You decide what to own. The desk decides only when." },
    paragraphs: [
      "A basket is a small group of companies you follow together. Predict it with test money, cover the members you hold, or let a desk hold it for you inside limits you set. Practice desks run today; live desks are planned.",
      "The desk wakes every hour, on the hour, around the clock. It reads PreStocks prices, asks one AI question about timing, and writes down what it did, including every time it did nothing. On Canton the limits are planned as Daml choices that refuse anything past them.",
      "It starts in practice: a paper ledger, everything real except spending money. A live desk is planned: its live leg will trade this venue's own markets once the Canton Coin rail lands.",
    ],
    story: "Every decision has a Check it button: your browser recomputes the record's fingerprint and compares it with the one the ledger holds for that action.",
    note: "Practice desks need no tokens, no real money and no eligibility.",
    open: "Open your desk →",
    fixtures: "Every state, from fixtures →",
    promise: [
      "It is your account: only you can withdraw, and only to your seat.",
      "It stays inside your limits, and the ledger itself is to enforce the money limits.",
      "It always explains itself, including every time it does nothing.",
      "The record cannot be quietly changed: its fingerprint is on the ledger with the action it describes.",
      "You can stop it at any moment: Pause, Withdraw, Close.",
    ],
    worstCase: "Worst case, in one sentence: if the desk's key were ever stolen, the thief could only make bad trades, at most your daily limit a day, until you pause.",
  },
  proof: {
    section: { index: "05", title: "Proof", desc: "Every party below opens its own page, and every settled Window opens on the proof page." },
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
  install: {
    eyebrow: "On your phone",
    title: "Install it from the browser.",
    line: "No store and no native build. Add Agari to your home screen and a call is one tap away.",
  },
  foot: {
    nav: "Agari pages",
    markets: "Markets",
    howItWorks: "How it works",
    download: "Get the app",
    docs: "Docs",
  },
} as const;

/**
 * The "not investment advice" line (`ADVICE_COPY.notAdvice`, lane 15d), wired into the landing footer at the S15 merge.
 * Null would hide the footer's advice paragraph.
 */
export const LANDING_ADVICE_SLOT: string | null = ADVICE_COPY.notAdvice;
