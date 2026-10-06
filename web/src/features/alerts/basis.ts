import { isTickerSymbol, isTokenOnlyKind, TICKERS } from "@agari/core/market";
import { ALERTS } from "./copy";
import type { AlertBasis } from "./store";

/**
 * The spot an asset's alert watches (C9e). A name that trades only around the clock — BTC and ETH on Canton, the
 * pre-IPO names and the baskets — has no NYSE session, so its rule uses the 24/7 basis and fires at any hour on a
 * fresh tick. A listed stock keeps the Regular basis and waits for the open.
 */
export function alertBasisOf(asset: string): AlertBasis {
  return isTickerSymbol(asset) && isTokenOnlyKind(TICKERS[asset].kind) ? "token" : "regular";
}

/** Where and when a rule for this asset fires: a 24/7 rule never waits for the NYSE open. */
export function alertFootLine(asset: string, sessionOpen: boolean, sessionLabel: string | null, notifications: string): string {
  if (alertBasisOf(asset) === "regular" && !sessionOpen) return ALERTS.foot.waiting(sessionLabel);
  return notifications === "granted" ? ALERTS.foot.on : ALERTS.foot.off;
}
