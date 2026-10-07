import type { TickerSymbol } from "@owarine/core/market";
import type { TraderRanking } from "@owarine/core/projection";
import { ensureMarkets, notDeployedReading, readVenueBoard, readVenueStatic, unwrap, type VenueBoard } from "@owarine/markets";
import type { Address } from "@owarine/core/types";
import { getDb } from "@owarine/db";
import { unstable_cache } from "next/cache";
import { readVenueFacts } from "@/app/api/venue/venue.server";
import { webEnv } from "@/lib/env";
import { ROLLING_MS, type BoardPeriod, type BoardSliceWire, type LeaderboardPayload, type RankBy } from "./protocol";
import { latestSession, type BoardSession } from "./session.server";

/**
 * The board, served: one venue-wide replay per few minutes per period, shared by every reader — server-side,
 * persisted in Next's Data Cache, no database and no credential. Expired snapshots remain available while the
 * framework refreshes them; a cold function instance can reuse the board. The route slices one ticker out of the
 * cached scan, so a ticker tab never pays for a scan of its own.
 *
 * `24h` is the reference's day: fills from two days back, so every Window that expired today has its whole life in
 * hand. `session` is the latest NYSE session that has opened, `[open, close + 15 min)` (the last Windows settle after
 * the bell), with an hour of lookback (the longest cadence). Both end at the time of the scan.
 */
const DAY_MS = 86_400_000;
const LOOKBACK_MS = 2 * DAY_MS;
const LONGEST_CADENCE_SEC = 3_600;
const SETTLE_TAIL_SEC = 900;
/** Rows served per rank: the scan keeps the top 50 by PnL and the top 50 by ROI (`topByEither`), so either order is exact. */
const TOP = 50;
/** `all` reaches back this far: before the Canton venue's first Window. */
const VENUE_EPOCH_MS = Date.UTC(2026, 0, 1);

/** The cached scan: the venue's payload plus every ticker's slice. */
export interface BoardCache {
  payload: LeaderboardPayload;
  byTicker: Partial<Record<TickerSymbol, BoardSliceWire>>;
}

const inFlight = new Map<BoardPeriod, Promise<BoardCache>>();

/**
 * Who is not a trader. The seed maker and settler crank are wallets, so they are listed per deployment
 * (Q-S5-2, server-only). The program seats are read from the venue's own config instead: the Trading Balance
 * vault books every tap and every runner fill under one pooled seat, and the maker vault quotes from another, so
 * the day either traded it topped the board as if it were a person. A list somebody has to remember to extend
 * was how that happened.
 */
async function operatorWallets(): Promise<string[]> {
  const listed = (process.env.OWARINE_OPERATOR_WALLETS ?? "").split(",").map((w) => w.trim()).filter(Boolean);
  const seats = await readVenueStatic().then((venue) => venue.programSeats as string[]).catch(() => []);
  return [...new Set([...listed, ...seats, ...(await venueParties())])];
}

/**
 * On Canton the counterparty of every published call is the venue party itself (the tape's `maker`); it is the house,
 * never a trader, so it is left off the board. Read from the projection's own stream party.
 */
async function venueParties(): Promise<string[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<{ party: string }[]>`SELECT DISTINCT party FROM idx_cursor`.then((rows) => rows.map((r) => r.party)).catch(() => []);
}

const rankingsWire = (rankings: readonly TraderRanking[]) => rankings.map((r) => ({ ...r, pnlBase: r.pnlBase.toString(), volumeBase: r.volumeBase.toString() }));

function serialize(board: VenueBoard, period: BoardPeriod, session: BoardSession | null, computedAtMs: number): BoardCache {
  const { traction } = board;
  const byTicker: BoardCache["byTicker"] = {};
  for (const [symbol, slice] of Object.entries(board.byTicker) as [TickerSymbol, NonNullable<VenueBoard["byTicker"][TickerSymbol]>][]) {
    byTicker[symbol] = { ...slice, rankings: rankingsWire(slice.rankings), totalVolumeBase: slice.totalVolumeBase.toString() };
  }
  const payload: LeaderboardPayload = {
    rankings: rankingsWire(board.rankings),
    traction: {
      ...traction,
      stakedBase: traction.stakedBase.toString(),
      recent: traction.recent.map((event) => ({ ...event, stakeBase: event.stakeBase.toString() })),
    },
    meta: {
      period,
      ticker: null,
      session,
      windowStartMs: board.windowStartMs,
      windowEndMs: board.windowEndMs,
      computedAtMs,
      rankedTraders: board.rankedTraders,
      totalWallets: board.totalWallets,
      closedCalls: board.closedCalls,
      totalVolumeBase: board.rankings.reduce((sum, r) => sum + r.volumeBase, 0n).toString(),
      complete: board.complete,
      decimals: board.decimals,
      symbol: board.symbol,
    },
  };
  return { payload, byTicker };
}

async function compute(period: BoardPeriod, nowMs: number): Promise<BoardCache> {
  // The deployment's env (`parseMarketsEnv()` with no input is devnet defaults only, with no venue).
  const env = webEnv.markets;
  ensureMarkets(env);
  // On Canton the venue id is derived from the projection's venue party (`/api/venue` facts); an env override still wins.
  // No venue at all: the board says so instead of ranking nothing.
  const venueId = (env.venueId ?? (await readVenueFacts().catch(() => null))?.venue.config ?? null) as Address | null;
  if (!venueId) return unwrap(notDeployedReading("no Owarine venue configured yet"));
  const operators = await operatorWallets();
  if (period !== "session") {
    // The day scans every Window (its traction counts them); longer boards scan only Windows somebody published in.
    const startMs = period === "all" ? VENUE_EPOCH_MS : nowMs - (ROLLING_MS[period] ?? DAY_MS);
    const lookbackMs = period === "24h" ? nowMs - LOOKBACK_MS : startMs - DAY_MS;
    const board = unwrap(
      await readVenueBoard({ venueId, windowStartMs: startMs, windowEndMs: nowMs, lookbackSec: Math.max(0, Math.floor(lookbackMs / 1000)), top: TOP, operators, publishedOnly: period !== "24h" }),
    );
    return serialize(board, period, null, nowMs);
  }
  const session = await latestSession(env.priceFeedUrl, Math.floor(nowMs / 1000));
  const endMs = Math.min(nowMs, (session.closeSec + SETTLE_TAIL_SEC) * 1000);
  const board = unwrap(
    await readVenueBoard({ venueId, windowStartMs: session.openSec * 1000, windowEndMs: endMs, lookbackSec: session.openSec - LONGEST_CADENCE_SEC, top: TOP, operators }),
  );
  return serialize(board, period, session, nowMs);
}

/** One compute per period at a time, however many readers arrive while it runs. */
function computeBoard(period: BoardPeriod): Promise<BoardCache> {
  let running = inFlight.get(period);
  if (!running) {
    running = compute(period, Date.now()).finally(() => inFlight.delete(period));
    inFlight.set(period, running);
  }
  return running;
}

/** Tag on every cached board: a publish or a retraction expires it, so the change is on the next read. */
export const BOARD_CACHE_TAG = "owarine-venue-board";

/** Key by the deployment's data source and the period, never by a per-request timestamp. */
export function readBoard(period: BoardPeriod): Promise<BoardCache> {
  const { cluster, venueId, indexerUrl } = webEnv.markets;
  return unstable_cache(() => computeBoard(period), ["owarine-venue-board-v7", cluster, venueId ?? "no-venue", indexerUrl ?? "no-indexer", period], { revalidate: 180, tags: [BOARD_CACHE_TAG] })();
}

type WireRanking = LeaderboardPayload["rankings"][number];

/** Return on stake first (no stake ranks last), then the board's own PnL order, which the input already has. */
function byRoi(rows: readonly WireRanking[]): WireRanking[] {
  return rows.map((r, i) => [r, i] as const).sort(([a, i], [b, j]) => (b.roiBps ?? -Infinity) - (a.roiBps ?? -Infinity) || i - j).map(([r]) => r);
}

/** The top 50 of the kept rows, by the chosen rank. */
function topOf(rows: readonly WireRanking[], rankBy: RankBy): WireRanking[] {
  return (rankBy === "roi" ? byRoi(rows) : rows).slice(0, TOP);
}

const stakeOf = (rows: readonly WireRanking[]) => rows.reduce((sum, r) => sum + BigInt(r.volumeBase), 0n).toString();

/** The venue's board, or one ticker's slice of it; a ticker with no closed rounds is an empty board, not an error. */
export function boardView({ payload, byTicker }: BoardCache, ticker: TickerSymbol | null, rankBy: RankBy = "pnl"): LeaderboardPayload {
  if (ticker === null) {
    const rankings = topOf(payload.rankings, rankBy);
    return { ...payload, rankings, meta: { ...payload.meta, totalVolumeBase: stakeOf(rankings) } };
  }
  const slice = byTicker[ticker] ?? { rankings: [], rankedTraders: 0, totalWallets: 0, closedCalls: 0, totalVolumeBase: "0" };
  const rankings = topOf(slice.rankings, rankBy);
  return {
    ...payload,
    rankings,
    meta: { ...payload.meta, ticker, rankedTraders: slice.rankedTraders, totalWallets: slice.totalWallets, closedCalls: slice.closedCalls, totalVolumeBase: stakeOf(rankings) },
  };
}
