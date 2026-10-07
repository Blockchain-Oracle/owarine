/**
 * When a live desk's hourly check runs (C8j, K-230). The reference's desk checked at the top of the hour against a
 * market that never closes (PreStocks tokens through Jupiter), and its only wait was for its data: "feed warming …
 * wakes wait". A live desk on Canton trades each name's hourly Window (K-090), and the hour's Window only quotes once
 * the roller has opened it on the hour's opening print, a few seconds to a minute after the hour; the previous
 * Window stopped quoting two minutes before. A check at the top of the hour therefore found nothing to price
 * (C8i records 5 and 6: "could not price OpenAI and Anthropic" at 06:00:0x and 07:00:0x).
 *
 * So the hour's check (and a move wake) of a live desk waits until every name it holds or targets has its hour's
 * Window quoting, and runs anyway once `HOUR_WINDOWS_GRACE_SEC` has passed, so a lane the roller never opens (its
 * print missing) is still checked and the record names what could not be priced. Practice desks price at the feed's
 * token print (K-091) and a check the owner asks for runs when asked, so neither waits.
 */
import type { PreIpoSymbol } from "@owarine/core/market";
import { quotingWindow } from "@owarine/markets/desk/server";
import type { Ladder } from "@owarine/markets/runtime";

/** The longest a live desk's hour check waits for the hour's Windows before it runs and records what it could not price. */
export const HOUR_WINDOWS_GRACE_SEC = 10 * 60;

/** The names whose Window for the hour starting `hourSec` is not quoting on the venue's ladder yet. */
export function namesAwaitingHourWindow(ladders: readonly Ladder[], names: readonly PreIpoSymbol[], hourSec: number): PreIpoSymbol[] {
  return names.filter((symbol) => {
    const window = quotingWindow(ladders, symbol);
    return !window || window.tradingStartSec < hourSec;
  });
}

/**
 * Whether a live desk's hour check waits this tick: the names still waiting for their Window, or an empty list when
 * the check may run (every Window quoting, no names at all, or the grace is over).
 */
export function hourCheckWaitsFor(input: { ladders: readonly Ladder[]; names: readonly PreIpoSymbol[]; hourSec: number; nowSec: number }): PreIpoSymbol[] {
  if (input.nowSec - input.hourSec >= HOUR_WINDOWS_GRACE_SEC) return [];
  return namesAwaitingHourWindow(input.ladders, [...new Set(input.names)], input.hourSec);
}
