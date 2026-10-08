import { TICKER_SYMBOLS } from "@owarine/core/market";
import type { Address } from "@owarine/core/types";
import { z } from "zod";
import { tractionSchema } from "@/features/stats/protocol";

/** Rolling periods include the venue's 24/7 assets; the NYSE session is an explicit stock-hours filter. */
export const BOARD_PERIODS = ["24h", "7d", "30d", "all", "session"] as const;
export type BoardPeriod = (typeof BOARD_PERIODS)[number];
/** Rolling periods by length; `all` reaches back to the venue's first Window. */
export const ROLLING_MS: Partial<Record<BoardPeriod, number>> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 };

/** Tradash's "Rank by": realised PnL (the board's own order) or return on stake. */
export const RANK_BY = ["pnl", "roi"] as const;
export type RankBy = (typeof RANK_BY)[number];

/** The NYSE session a `session` board covers: `[openSec, closeSec + 15 min)`, capped at the time it was computed. */
const sessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number() });

/** Wire shape of `/api/leaderboard` — base units travel as decimal strings, never floats. */
const rankingSchema = z.object({
  owner: z.string(),
  pnlBase: z.string(),
  roiBps: z.number().nullable(),
  winRatePct: z.number(),
  tradeCount: z.number(),
  settledTrades: z.number(),
  bestStreak: z.number(),
  volumeBase: z.string(),
});

export const leaderboardPayloadSchema = z.object({
  rankings: z.array(rankingSchema),
  /** The same scan's traction, served to `/api/traction` from the same cache. */
  traction: tractionSchema,
  meta: z.object({
    period: z.enum(BOARD_PERIODS),
    /** Null for the whole venue; a symbol when the route sliced one ticker's board from the cached scan. */
    ticker: z.enum(TICKER_SYMBOLS).nullable(),
    session: sessionSchema.nullable(),
    windowStartMs: z.number(),
    windowEndMs: z.number(),
    computedAtMs: z.number(),
    rankedTraders: z.number(),
    totalWallets: z.number(),
    closedCalls: z.number(),
    totalVolumeBase: z.string(),
    /** False when a paging cap or a dropped page means the window is not fully covered. */
    complete: z.boolean(),
    decimals: z.number(),
    symbol: z.string(),
  }),
});

export type LeaderboardPayload = z.infer<typeof leaderboardPayloadSchema>;

/** One ticker's board inside the cached scan (`VenueBoard.byTicker`), sliced out by the route. */
export interface BoardSliceWire {
  rankings: LeaderboardPayload["rankings"];
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  totalVolumeBase: string;
}

export interface BoardRanking {
  owner: Address;
  pnlBase: bigint;
  roiBps: number | null;
  winRatePct: number;
  tradeCount: number;
  settledTrades: number;
  bestStreak: number;
  volumeBase: bigint;
}

type WireMeta = LeaderboardPayload["meta"];

export interface BoardData {
  rankings: BoardRanking[];
  /** `ticker` and `session` are optional here so canned boards from before S5 still render as the venue's 24 h board. */
  meta: Omit<WireMeta, "totalVolumeBase" | "ticker" | "session"> & { totalVolumeBase: bigint; ticker?: WireMeta["ticker"]; session?: WireMeta["session"] };
}

export function toBoardData(payload: LeaderboardPayload): BoardData {
  return {
    rankings: payload.rankings.map((r) => ({ ...r, owner: r.owner as Address, pnlBase: BigInt(r.pnlBase), volumeBase: BigInt(r.volumeBase) })),
    meta: { ...payload.meta, totalVolumeBase: BigInt(payload.meta.totalVolumeBase) },
  };
}
