import { TICKERS, type TickerSymbol } from "@owarine/core/market";
import type { MarketSession } from "@/features/markets/session";
import type { WindowState } from "./ui/Chrome";

/**
 * Why a market cannot be traded right now, in one plain sentence (Abu, 8 Oct: "if it's disabled, tell me why"). Read
 * from what the venue reports, never guessed: the US session for a stock, then the roller's state for this market's
 * lanes, then this round's own state. The same reasons label the market picker, short form.
 */
export const WHY = {
  stockClosed: (opens: string) => `The US stock market is closed. ${opens}.`,
  networkBusy: "Canton DevNet is refusing new transactions from our node right now, so rounds can't record their starting price. Prices stay live; Up and Down come back when it clears.",
  noSource: "Paused: this market's price provider isn't answering, so a round couldn't settle. Prices stay live.",
  stale: "Paused: this market's price feed went stale. It resumes when fresh prices return.",
  pricing: "Waiting for this round's starting price. Up and Down open once it is recorded.",
  waiting: "The venue isn't quoting this round yet.",
  next: "The next round opens in a moment.",
  locked: "This round has stopped taking trades. The next one opens shortly.",
  indexDelayed: "The venue has opened a round, but its live market data has not reached the app yet.",
  none: "No round is open for this market right now.",
  short: {
    networkBusy: "Paused · network busy",
    noSource: "Paused · price provider down",
    stale: "Paused · price feed stale",
    next: "Next round soon",
    indexDelayed: "Round data delayed",
    none: "No round right now",
  },
} as const;

const isStock = (symbol: string): boolean => {
  const kind = symbol in TICKERS ? TICKERS[symbol as TickerSymbol].kind : null;
  return kind === "stock" || kind === "etf";
};

/** The roller's state for each of this symbol's lanes (`BTC-2m: open #838 …`, `CC-5m: paused: no signed source …`). */
const laneStatesOf = (session: MarketSession | null, symbol: string): string[] =>
  session ? Object.entries(session.lanes).filter(([key]) => key.split("-")[0] === symbol).map(([, state]) => state) : [];

/** True while the roller holds lanes back because DevNet refused a submit for lack of traffic. */
export const networkBusy = (session: MarketSession | null): boolean => (session ? Object.values(session.lanes).some((s) => s.includes("traffic")) : false);

type Reason = "stockClosed" | "networkBusy" | "noSource" | "stale" | null;

function reasonOf(session: MarketSession | null, symbol: string): Reason {
  if (isStock(symbol) && session && !session.open) return "stockClosed";
  const lanes = laneStatesOf(session, symbol);
  if (lanes.length > 0 && lanes.every((s) => s.startsWith("paused"))) {
    if (lanes.some((s) => s.includes("signed source"))) return "noSource";
    if (lanes.some((s) => s.includes("halted"))) return "stale";
    if (lanes.some((s) => s.includes("traffic"))) return "networkBusy";
  }
  return null;
}

/** The sentence under the trade buttons; null while the round is trading. */
export function whyNotTrading(state: WindowState, symbol: string, session: MarketSession | null): string | null {
  if (state === "trading") return null;
  const reason = reasonOf(session, symbol);
  if (reason === "stockClosed") return WHY.stockClosed(session!.label);
  if (reason) return WHY[reason];
  if ((state === "pricing" || state === "waiting") && networkBusy(session)) return WHY.networkBusy;
  if (state === "none" && laneStatesOf(session, symbol).some((s) => s.startsWith("open #"))) return WHY.indexDelayed;
  return WHY[state];
}

/** The picker's short label for a market with no round to pick. */
export function shortWhy(symbol: string, session: MarketSession | null): string {
  const reason = reasonOf(session, symbol);
  if (reason === "stockClosed") return `Closed · ${session!.label}`;
  if (reason) return WHY.short[reason];
  if (laneStatesOf(session, symbol).some((s) => s.startsWith("open #"))) return WHY.short.indexDelayed;
  return laneStatesOf(session, symbol).some((s) => s.startsWith("waiting")) ? WHY.short.next : WHY.short.none;
}
