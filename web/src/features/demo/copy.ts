/**
 * `/demo` — ported from `reference/yosuku/app/demo/page.tsx`.
 *
 * The reference's structure is kept line for line; every claim is rewritten to what Owarine does on the Canton test
 * network (C4c). C10f: no footage or screenshot recorded before the Canton port is shown. The film comes from one config
 * point (`OWARINE_DEMO_VIDEO_URL`, `web/src/lib/release.ts`) and the frame names what it waits on until it is set; the
 * screenshots are dated captures of the Canton build on a local sandbox; the receipts list is empty until the Canton
 * DevNet drive records its own. Nothing here names an X handle.
 */
export const DEMO = {
  title: "Demo",
  video: {
    title: "Owarine — demo",
    description: "A private call on Canton: a firm quote from the venue, a position only you and the venue can see, three oracle parties at the close, and a settlement you can audit.",
    caption: "Recorded on the Canton build: a seat, a call at the venue's firm quote, who can see it, a sell-back, and the settlement.",
    watch: "Watch on YouTube ↗",
  },
  bar: {
    brand: "OWARINE",
    sub: "/ demo",
    pitch: "pitch",
    stats: "stats",
    open: "open the app",
  },
  /** The film's frame while `OWARINE_DEMO_VIDEO_URL` is unset (the D-015 honest state). */
  film: {
    pendingLabel: "The demo film is not published yet",
    pendingEyebrow: "The Canton film",
    pendingLine: "Being re-shot on the Canton build. It plays here once it is published; until then, the walkthrough below is the demo, and every frame in it is the Canton build.",
    pendingMeta: "Not connected yet · waiting on the demo film recorded on the Canton build",
  },
  hero: {
    eyebrow: "live demo",
    headline: "See Owarine ",
    headlineSerif: "work.",
    videoLabel: "▶ demo · the Canton build",
    lead: "Up or down on a stock, a coin or an event at the venue's firm quote, in a position only you and the venue can see, settled on a price three oracle parties sign — one tap, no wallet app, on the web and as an installable app. Full feature breakdown and the proof page below.",
    open: "Open the app",
    stats: "View live stats",
    pitch: "See the pitch",
  },
  traction: {
    reading: "reading the venue…",
    failed: "the venue read is unavailable right now",
    wallets: (n: string) => `${n} seats ranked`,
    calls: (n: string) => `${n} closed calls`,
    period: (period: string) => `last ${period}`,
    partial: "partial day",
    live: "live on the Canton test network",
  },
  sections: {
    tap: {
      kicker: "01 · the ritual",
      headline: "One tap. ",
      headlineSerif: "That's the whole thing.",
      body: "Pick a side, see exactly what you'd win for your size, tap. The price is the venue's firm quote, the settlement is the signed print's, and the receipt opens on the proof page. When the market is shut, the same ticket rests a call at your price for the open. Private: only your seat and the venue see it.",
      link: "try a market",
    },
    reel: {
      kicker: "02 · the reel",
      headline: "A feed of Windows, ",
      headlineSerif: "like short-form video.",
      body: "Swipe through Windows across every lane the venue lists — the session's 5m, 15m and 60m, the weekend Gap, the 24/7 token lane — with community takes woven between them. Any call is one tap from a position.",
      link: "open the reel",
    },
    social: {
      kicker: "03 · private by default",
      headline: "Who can see it? ",
      headlineSerif: "Ask the ledger.",
      body: "Every position carries a \"Who can see this\" switch: Alice, Bob, an outsider and you, each a live ledger query as that party with the request body on screen. Your position is a contract between your seat and the venue, so the outsider's query comes back empty. The Room is callers only, gated by the same kind of read, and Sensei reads the same market stream the page holds.",
      room: "who sees what, contract by contract",
      sensei: "open a Window's Room",
    },
    depth: {
      kicker: "04 · real depth, still private",
      headline: "A real venue under the ",
      headlineSerif: "simple front door.",
      cards: {
        book: {
          title: "Firm-quote pricing",
          body: "A firm quote from the venue over its published price ladder. Your size is priced before you tap, the quote holds while you take it, and every fill is a Daml contract.",
        },
        receipts: {
          title: "Settlement receipts",
          body: "Opening print, closing print, their source and signer count, and the settlement — every line on the receipt is a link, and a void names its reason.",
        },
        edge: {
          title: "Trader Edge & the board",
          body: "One replay of the venue's ledger feeds history, P&L, Trader Edge and the leaderboard, and a payout is the ledger paying exactly what the settlement rule says it owes.",
        },
      },
      proven: "proven on the ledger",
    },
    verify: {
      kicker: "05 · don't trust it. verify it.",
      headline: "Real actions. ",
      headlineSerif: "Open receipts.",
      body: "One Window's whole life — listed, funded, called, filled, printed, settled and paid — and a void beside it. Every receipt opens on the proof page.",
      readOn: (wallet: string, date: string) => `Owarine on the Canton test network · placed by the drive seat ${wallet} and the venue's own roller, oracle, resolver and settler parties · checked on ${date}. These record completed actions, not current balances.`,
      fork: "local sandbox",
      pending: "Not recorded yet: these receipts land once the Canton DevNet drive runs. Until then every settlement on this venue opens on the proof page.",
      contracts: "The parties every Window runs on",
    },
  },
  close: {
    headline: "The front door is ",
    headlineSerif: "open.",
    footer: "Owarine · stock prediction Windows on Canton, open after the bell.",
  },
  frame: {
    caption: (date: string) => `captured from the Canton build on a local sandbox · ${date}`,
    markets: "Owarine's market board on Canton: an ETH one-minute Window, its opening print, the time left and the Up and Down prices",
    reel: "The same board at phone width, where the reel and the bottom dock live",
    sensei: "Who can see this, as an outsider: the ledger query names the outsider party and returns no contracts",
  },
  /** Every screenshot under /public/demo is a crop of a Canton capture in docs/evidence/ux, taken on this day. */
  capturedOn: "2026-09-29",
} as const;
