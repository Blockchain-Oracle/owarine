/**
 * `/demo` — ported from `reference/yosuku/app/demo/page.tsx`.
 *
 * The reference's structure is kept line for line; every claim is rewritten to what Agari does on the Canton test
 * network (C4c). The video and screenshots were recorded before the Canton port, and the copy says so; the receipts
 * list is empty until the Canton DevNet drive records its own. Nothing here names an X handle.
 */
export const DEMO = {
  title: "Demo",
  video: {
    title: "Agari — demo",
    description: "Call whether a US stock closes its Window up or down, settled on a signed price. Recorded before the Canton port; the flow is the same.",
    caption: "Markets on the NYSE clock, the call before the bell, and a settlement you can audit. Recorded on the running product.",
    watch: "Watch on YouTube ↗",
  },
  bar: {
    brand: "AGARI",
    sub: "/ demo",
    pitch: "pitch",
    stats: "stats",
    open: "open the app",
  },
  hero: {
    eyebrow: "live demo",
    headline: "See Agari ",
    headlineSerif: "work.",
    videoLabel: "▶ demo · before the Canton port",
    lead: "Up or down on a US stock, settled on a signed price the ledger checks itself — one tap, no wallet app, on the web and as an installable app, and still open after the bell. Full feature breakdown and the proof page below.",
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
      kicker: "03 · social by default",
      headline: "The Room, and a ",
      headlineSerif: "second opinion.",
      body: "Every Window has a Room — callers only, and the gate is a ledger read, not a setting. Sensei reads the same market stream the page holds and says what it sees, or says plainly when it has no key.",
      room: "open a Window's Room",
      sensei: "ask Sensei",
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
      readOn: (wallet: string, date: string) => `Agari on the Canton test network · placed by the drive seat ${wallet} and the venue's own roller, oracle, resolver and settler parties · checked on ${date}. These record completed actions, not current balances.`,
      fork: "local sandbox",
      pending: "Not recorded yet: these receipts land once the Canton DevNet drive runs. Until then every settlement on this venue opens on the proof page.",
      contracts: "The parties every Window runs on",
    },
  },
  close: {
    headline: "The front door is ",
    headlineSerif: "open.",
    footer: "Agari · stock prediction Windows on Canton, open after the bell.",
  },
  frame: {
    caption: (date: string) => `captured from the product before the Canton port · ${date}`,
    markets: "Agari's market board after the close: the last price, the next session on the clock, and the ticket beside it",
    reel: "The reel after the close: the next session on the clock, with the latest takes a swipe away",
    sensei: "Sensei open over the market, reading the same stream the page holds",
  },
  /** Every screenshot under /public/demo was taken on this day, from the running product. */
  capturedOn: "2026-09-15",
} as const;
