/**
 * Lane keys: `BTC-5m` (a Series' lane), `TSLA-gap`, `TSLAx-5m` (a listed ticker's 24/7 token lane), and `BTC-2m_1` (a
 * staggered Series, anchored a whole number of minutes off its cadence grid). Split from `tickers.ts`, which re-exports it.
 */
import { GAP_CADENCE_SEC, type LaneBasis } from "../types/market";
import { isTickerSymbol, isTokenOnlyKind, laneListable, TICKER_SYMBOLS, TICKERS, tokenLaneAsset, type TickerSymbol } from "./tickers";

export function laneKey(symbol: TickerSymbol, basis: LaneBasis, cadenceSec: number, phaseSec = 0): string {
  // An off-lane key names no lane: `parseLaneKey` returns null for it, so no clock is ever derived from it.
  if (!laneListable(symbol, basis)) return `#${symbol}-${basis}-${cadenceSec}`;
  if (basis === "gap") return `${symbol}-gap`;
  const asset = basis === "token" ? (tokenLaneAsset(symbol) ?? symbol) : symbol;
  return `${asset}-${cadenceSec / 60}m${phaseSec > 0 ? `_${phaseSec / 60}` : ""}`; // `BTC-2m_1`: a staggered Series
}

export interface LaneKeyParts {
  symbol: TickerSymbol;
  basis: LaneBasis;
  cadenceSec: number;
  phaseSec?: number; // a staggered Series' anchor offset (`BTC-2m_1` → 60), absent for a lane's first Series
}

/** The inverse of `laneKey`: `TSLA-60m` → Regular 3,600 s, `TSLA-gap` → Gap, `TSLAx-5m` → the TSLA token lane. Null for anything else. */
export function parseLaneKey(key: string): LaneKeyParts | null {
  const dash = key.lastIndexOf("-");
  if (dash <= 0) return null;
  const asset = key.slice(0, dash);
  const tail = key.slice(dash + 1);
  if (tail === "gap") return isTickerSymbol(asset) && laneListable(asset, "gap") ? { symbol: asset, basis: "gap", cadenceSec: GAP_CADENCE_SEC } : null;
  const minutes = /^(\d+)m(?:_(\d+))?$/.exec(tail);
  if (!minutes) return null;
  const cadenceSec = Number(minutes[1]) * 60;
  if (cadenceSec <= 0) return null;
  const phaseSec = Number(minutes[2] ?? 0) * 60;
  const phase = phaseSec > 0 ? { phaseSec } : {};
  if (phaseSec >= cadenceSec) return null;
  // A bare pre-IPO or basket symbol is its 24/7 lane (it has no other), a bare listed ticker is its Regular lane.
  if (isTickerSymbol(asset)) return { symbol: asset, basis: isTokenOnlyKind(TICKERS[asset].kind) ? "token" : "regular", cadenceSec, ...phase };
  const underlying = TICKER_SYMBOLS.map((s) => TICKERS[s]).find((t) => t.xstock?.symbol === asset);
  return underlying ? { symbol: underlying.symbol, basis: "token", cadenceSec, ...phase } : null;
}
