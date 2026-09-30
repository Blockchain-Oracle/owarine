import { SEAT } from "~/wallet/seat-copy";

/**
 * The app's first run (S26, the owner's call 09-25: "every mobile app has an onboarding flow"). Four screens before
 * the app, each one true of the product today: a Window is a live question on a real stock, the price settles it on
 * the ledger, the games play the same Windows, and the last page is the demo-credits gate (plan, iOS step 3): a test
 * network, demo credits with no cash value, nothing to buy, sell or withdraw. Accepting it takes the seat. Web's
 * in-page Tutorial card says the same things over /markets; the app shows this instead, once per install.
 */

export interface OnboardingPage {
  readonly key: "call" | "settle" | "play" | "start";
  readonly eyebrow: string;
  readonly title: string;
  /** The title's last words, set in the accent as web's display heads do. */
  readonly accent: string;
  readonly body: string;
}

export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  {
    key: "call",
    eyebrow: "Stock prices · Canton",
    title: "Call where a stock",
    accent: "closes.",
    body: "Every Window asks one question about a real stock — above or below a line when the clock runs out. Tap Up or Down; the ticket shows the exact cost before you place it.",
  },
  {
    key: "settle",
    eyebrow: "No one decides but the price",
    title: "Settled by the",
    accent: "price.",
    body: "At the close the recorded price settles the Window on the ledger, and a winning call pays out. Nobody picks the result.",
  },
  {
    key: "play",
    eyebrow: "Same markets, more ways in",
    title: "Play the same",
    accent: "Windows.",
    body: "Lucky draws a call for you, Duel puts you head to head, Range and Moonshot price a band or a reach, and two arcade runs need no stake at all.",
  },
  {
    key: "start",
    eyebrow: SEAT.terms.eyebrow,
    title: SEAT.terms.title,
    accent: SEAT.terms.accent,
    body: SEAT.terms.body,
  },
];

export const ONBOARDING_UI = {
  skip: "Skip",
  next: "Next",
  accept: SEAT.terms.accept,
  browse: SEAT.terms.browse,
  progress: (step: number, total: number) => `${step} of ${total}`,
  example: "Live now",
  settle: {
    opening: "opening print",
    closing: "closing print",
    verdict: "UP wins",
    // The sources the venue's prints are read from (web's Built on band and `printSourceName`), as plain names.
    sources: { label: "Prices read from", names: "Coinbase · Kraken · Bitstamp · RedStone · Alpaca · Jupiter Price v3 · PreStocks" },
  },
  games: [
    { name: "Lucky", line: "A call drawn for you" },
    { name: "Duel", line: "Head to head" },
    { name: "Range", line: "Inside the band" },
    { name: "Moonshot", line: "A priced reach" },
    { name: "Line Rider", line: "Arcade · no stake" },
    { name: "Candle Hop", line: "Arcade · no stake" },
  ],
  funds: { label: "Demo credits", amount: "Free", note: "No cash value · test network" },
} as const;
