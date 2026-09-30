import { CalendarClockIcon, ClockIcon, MoonIcon, OctagonAlertIcon, ScaleIcon, WalletIcon, type LucideIcon } from "lucide-react";

/**
 * The facts Masayume's venue never had: a market clock.
 *
 * Masayume traded BTC and ETH, which never close, so its `/how-it-works` has no session, no lane and no halt. Agari
 * trades stocks, so the page keeps every Masayume section and adds two of its own in the same card grammar (D-081,
 * D-093): "Sessions & Lanes" after Getting Started, and "Halts, Voids & Your Money" after the Settlement Process.
 *
 * Sources, asserted rather than assumed: `docs/plan/specs/session-lanes.md` §1–§3 (the Gap and token lanes, halts,
 * voids), `services/ops/src/prices/lane-versions.ts` and `services/ops/config/price-sources.json` (which source each lane
 * settles on), `daml/abu-pm-main/daml/PM/Oracle.daml` and `scripts/bootstrap/venue.ts` (quorum 2 of 3, the 1% spread
 * band), `packages/core/src/copy/session-words.ts` (D-087 words), `web/src/lib/copy-preopen.ts` (D-088, as Canton
 * runs it), `packages/core/src/market/halts.ts` (D-057 / Q-S6-9 labels and the C6f thresholds), `packages/core/src/
 * market/void-reason.ts` (the void line), `web/src/features/session/copy.ts` (the Trading Balance and its caps).
 */

export interface Lane {
  name: string;
  clock: string;
  body: string;
  icon: LucideIcon;
}

/** The three lanes the venue lists, in board order (`packages/core/src/market/lanes.ts`: regular, gap, token). */
export const LANES: readonly Lane[] = [
  {
    name: "Regular",
    clock: "5m · 15m · 60m · NYSE hours",
    body: "Windows run back to back while US markets are open, 09:30 to 16:00 ET, Monday to Friday. A 5m Window opens on the five-minute mark and settles five minutes later; 15m and 60m run the same way on their own marks. The venue lists nothing outside the session, and an early close ends the lane early.",
    icon: ClockIcon,
  },
  {
    name: "Gap",
    clock: "Friday close → Monday open",
    body: "One Window a week across the weekend. Calls open at Friday's 16:00 ET close, the Window locks Sunday 20:00 ET, and it settles on Monday's first regular-session print at 09:30:00 ET — the opening print of the new session, not the opening cross.",
    icon: MoonIcon,
  },
  {
    name: "Token",
    clock: "24/7 · xStocks",
    body: "Tokenised stock — TSLAx, NVDAx, SPYx, QQQx — keeps trading when the exchange does not, so these Windows run every hour of every day on the same 5m, 15m and 60m cadences. They settle on the token's own price, the median of three Jupiter Price v3 samples taken just before the boundary and attested by the three oracle parties, not the exchange's print.",
    icon: CalendarClockIcon,
  },
];

/** D-087: the session is a word and a countdown, everywhere. `sessionStateWord` is the one source of these. */
export const SESSION_WORDS: readonly [string, string][] = [
  ["Open", "the exchange is trading; Windows open and close on their marks"],
  ["Pre-market", "before 09:30 ET — the first Windows are listed; calls open at the bell"],
  ["After hours", "after 16:00 ET — the session is done and the next open is on the clock"],
  ["Weekend", "Saturday or Sunday; the Gap Window is the lane that is awake"],
  ["Holiday", "the exchange is shut for the day, and the chip says so by name"],
  ["Early close", "a half day — 13:00 ET — and the lane ends with it"],
];

/**
 * D-088 as Canton runs it (`web/src/lib/copy-preopen.ts`): the Windows list at the close, but a call cannot rest on
 * one yet (no `RestingCall`; the submitter refuses a rest). Nothing here is softened, and nothing is promised.
 */
export const PRE_OPEN = {
  title: "Calls before the bell",
  body: "The venue lists tomorrow's first Windows at tonight's close, so you can see them while the market is shut. On Canton a call cannot rest on a listed Window yet: the Window takes calls from the bell.",
  points: [
    "Nothing is signed and none of your credits are held before the bell. The ticket's Schedule button says so instead of sending.",
    "At the bell the Window trades like any other: your seat takes the venue's firm quote in one tap.",
    "Resting a call at your own price, with its 90-second expiry and its opt-in rest until the Window locks, is not on Canton yet.",
  ],
} as const;

export interface BasisRow {
  source: string;
  detail: string;
}

/**
 * Which source each Window settles on (`lane-versions.ts`, the table the venue registers every Series from) and what
 * the ledger checks before a price counts (`Oracle.daml`, the Series' quorum 2 of 3 and `maxDeviationBps` 100). Every
 * source here runs; the receipt names it.
 */
export const BASIS_ROWS: readonly BasisRow[] = [
  { source: "Coinbase, Kraken and Bitstamp", detail: "BTC and ETH: the close of each exchange's 1-minute candle at the boundary, one exchange per oracle party" },
  { source: "RedStone", detail: "TSLA, NVDA, AAPL, MSFT, META, AMZN and GOOGL: the median of RedStone's signed price packages at the boundary, from at least 3 of its 5 signers" },
  { source: "Alpaca", detail: "QQQ and VOO: the last IEX trade at or before the boundary, no more than five minutes old" },
  { source: "Jupiter Price v3", detail: "TSLAx, NVDAx, SPYx and QQQx: the median of three samples, taken 40 seconds and 20 seconds before the boundary and at it" },
  { source: "PreStocks", detail: "the eight pre-IPO names: the PreStocks token price read just after the boundary; a basket is an index computed from one read of every member" },
  { source: "Cross-check", detail: "the three oracle parties each post their own print; at least 2 must post, and if the prints are more than 1% apart, measured against their median, the Window voids at that boundary" },
];

export interface Aside {
  title: string;
  body: string;
  icon: LucideIcon;
}

/** D-057 / Q-S6-9 wording, and the void line the verdict actually prints. */
export const ASIDES: readonly Aside[] = [
  {
    title: "Halts",
    body: "There is no licensed halt feed here, so a lane is halted when the signed price it settles on stops being printable, judged on that lane's own source and nothing else: no RedStone package for 60 s (TSLA, NVDA, AAPL, MSFT, META, AMZN, GOOGL), no IEX trade from Alpaca for 120 s (QQQ, VOO), no PreStocks read for 60 s (a pre-IPO name or basket), or three failed Jupiter Price v3 quotes in a row (an xStock). Each says “Signed price stale”. An xStock its issuer has flagged as halted says “Trading halted”. Stock lanes are watched while the exchange is open, the others at every hour; BTC and ETH have no halt, since a missing or disagreeing print voids their Window. A halted lane gets no new Windows and the maker pulls its quotes. A halt never touches the ledger, and it is never given as the reason a Window resolved.",
    icon: OctagonAlertIcon,
  },
  {
    title: "Voids",
    body: "If no reliable print lands inside the settlement window, the Window voids and both sides get back what they paid, stake and fee. The verdict says “Void — no reliable print, both sides get their stake and fee back”, and one line under it says why: a missing print names the source, the boundary and the deadline it passed; a disagreement names the 1% band the oracle parties' prints fell outside. Redemption credits the venue, the same as a win.",
    icon: ScaleIcon,
  },
  {
    title: "Your money",
    body: "Everything here is demo credits on the Canton test network, issued by the venue — it is worth nothing anywhere else. Your seat's key is made in this browser and cannot leave it, so a call costs one tap and no network fee. Only your seat's party and the venue can see your cash and positions. Nothing on the server ever holds a key of yours.",
    icon: WalletIcon,
  },
];
