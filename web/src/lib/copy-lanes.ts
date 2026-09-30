/**
 * The S6 session-lane words (session-lanes.md §5): Gap and 24/7 token states, halts, source notes and the earnings
 * warning. Split from `copy.ts` for the 400-line rule; imported through `@/lib/copy`. Clock arguments are ET wall text
 * ("Fri 16:00", "Mon 09:30:00") from the Window's own timestamps, so a holiday Monday reads "Tue".
 */

export const LANE_STATE = {
  /** Lane tabs: `5m`, `15m`, `1h`, `Gap`, `5m · 24/7`. */
  tab: {
    gap: "Gap",
    token: (cadence: string) => `${cadence} · 24/7`,
  },
  gap: {
    name: "Monday Gap",
    /** "TSLA opens Mon above" — the line follows, as `holdsAbove` does. */
    opensAbove: (asset: string, weekday: string) => `${asset} opens ${weekday} above`,
    locks: (when: string) => `Locks ${when}`,
    settles: (when: string) => `Settles ${when}`,
    settledClock: "settled",
    /** The card's clock slot, as a paused card's says "paused". */
    listedClock: "listed",
    /** The Listed card (M `.market-card-pending`): trading starts at the Friday close. */
    listed: (opens: string) => `Monday Gap · calls open ${opens}`,
    listedWhy: (locks: string, settles: string) => `Locks ${locks} · settles on the ${settles} print.`,
    locked: (settles: string) => `LOCKED · SETTLES ${settles.toUpperCase()}`,
    pendingOpen: "WAITING FOR THE FRIDAY PRINT",
    settled: { up: "SETTLED · UP WON", down: "SETTLED · DOWN WON", void: "VOID · BOTH SIDES PAY 0.5" },
  },
  source: {
    gap: (open: string, close: string) => `Settles on the oracle price at ${open} ET and ${close} ET (first regular-session print, not the opening cross)`,
    token: (xstock: string) => `Settles on the Jupiter Price v3 median of three ${xstock} token price reads at each boundary, attested by three oracle parties · the live price is that feed`,
    /** A valuation lane (S20, D-125): Pyth's valuation index for the company, read and attested by the oracle parties (C6). */
    valuation: (name: string) => `Settles on Pyth's ${name} valuation index at open and close, attested by three oracle parties · chart follows the index`,
    /** A pre-IPO name (D-100, D-101): one source, attested by the oracle parties (C6); the chart follows the same read. */
    preIpo: (name: string) => `Settles on the PreStocks ${name} token price, read ≤ 45 s after each boundary and attested by three oracle parties · single source, no cross-check`,
    /** A basket (S19, D-124): the index computed from one read of every member, in points. */
    basket: (name: string, members: string) => `Settles on the ${name} index, in points: ${members} weighted equally from one PreStocks read ≤ 45 s after each boundary, attested by three oracle parties · single source`,
    /** C6: BTC and ETH, every cadence. */
    crypto: (asset: string) => `Settles on the median ${asset} 1-minute candle close of Coinbase, Kraken and Bitstamp, one per oracle party · chart follows Coinbase`,
    /** C6: a committee-attested event (an Addition). */
    event: "Settles YES or NO on the committee's attestation, recorded by the resolver and the venue",
  },
  /** C6: a 4 h or 1 d 24/7 Window listed a cadence ahead, before its open. */
  longListed: {
    headline: (opens: string) => `Listed · opens ${opens}`,
    why: (settles: string) => `Calls open at the start, once the oracle parties' opening print sets the line. Settles ${settles}.`,
  },
  /** C6: the roller's reason inside `paused: no signed source (<why>)`, under the paused card's line. */
  pausedReason: (why: string) => `Source check: ${why}.`,
  /** An earnings line under the ticket's strip: a warning, never a blocker (L-32). */
  earnings: {
    /** `when` is "after the close today", "before the open Mon", or "today" when Finnhub gives no hour. */
    session: (asset: string, when: string) => `${asset} reports ${when} — prices can gap`,
    gap: (asset: string, when: string) => `${asset} reports ${when} — the Monday open can gap`,
    hour: { bmo: "before the open", amc: "after the close", dmh: "during market hours" },
    today: "today",
  },
  /** The roller's `paused: halted (<reason>)` on a lane card; the headline is `MARKETS.halt`. */
  haltWhy: (asset: string, cadence: string) => `No new ${cadence ? `${cadence} ` : ""}${asset} Window opens until the signed price is healthy again. Open Windows settle or void on their own prints.`,
  /** `MARKETS.paused.why` for a lane named without a cadence ("QQQ Gap"). */
  pausedWhy: (lane: string) => `No ${lane} Window opens until a signed print can settle it. The other tickers keep rolling.`,
} as const;
