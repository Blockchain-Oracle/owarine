/** Which of a basket's Windows is trading (S19, D-124): the hub, `/baskets` and the `/dev` fixtures all read it. */
import { phase } from "@owarine/core/lifecycle";
import type { EventMarket, LaneSet } from "@owarine/core/types";

/** The basket's trading 24/7 Window (the longest-running one when two overlap at a boundary), or null. */
export function tradingBasketWindow(laneSet: LaneSet | null, symbol: string, nowMs: number): EventMarket | null {
  if (!laneSet || nowMs === 0) return null;
  const trading = laneSet.lanes.flatMap((lane) => lane.markets).filter((m) => m.asset === symbol && m.lane === "token" && phase(m, nowMs) === "trading");
  return [...trading].sort((a, b) => b.expirySec - a.expirySec)[0] ?? null;
}
