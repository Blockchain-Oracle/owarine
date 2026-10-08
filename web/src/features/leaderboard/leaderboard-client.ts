import type { TickerSymbol } from "@owarine/core/market";
import { leaderboardPayloadSchema, toBoardData, type BoardData, type BoardPeriod, type RankBy } from "./protocol";

export const BOARD_REFRESH_MS = 60_000;
export const BOARD_REQUEST_TIMEOUT_MS = 25_000;

/** Which board: the period's cached scan, whole or sliced to one ticker. */
export interface BoardQuery {
  period: BoardPeriod;
  ticker: TickerSymbol | null;
  /** PnL (default) or ROI. */
  rankBy?: RankBy;
}

export const DEFAULT_BOARD: BoardQuery = { period: "24h", ticker: null };

/** The request is bounded even when the route or an upstream scan stops answering. */
export async function readLeaderboard(signal?: AbortSignal, query: BoardQuery = DEFAULT_BOARD): Promise<BoardData> {
  const timeout = AbortSignal.timeout(BOARD_REQUEST_TIMEOUT_MS);
  const params = new URLSearchParams({ period: query.period, ...(query.ticker ? { ticker: query.ticker } : {}), ...(query.rankBy === "roi" ? { rank: "roi" } : {}) });
  const response = await fetch(`/api/leaderboard?${params}`, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`leaderboard route answered ${response.status}`);
  return toBoardData(leaderboardPayloadSchema.parse(await response.json()));
}
