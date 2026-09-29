"use client";

import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, Lane, MarketId, Side } from "@agari/core/types";
import { Pager } from "@/components/chrome";
import { EmptyState } from "@/components/states";
import { MARKETS } from "@/lib/copy";
import { usePager } from "@/lib/use-pager";
import type { MarketSession } from "../session";
import { pausedInLane } from "./next-window";
import { laneAssetLabel, laneCadenceLabel } from "./lane-view";
import { LaneRows } from "./LaneRows";
import { TickerPicker } from "./TickerPicker";
import { laneTickers, tickerMarkets } from "./useTickerPin";

/** Two rows of the four-up rail at 1440 (`.markets-grid-live` fills 300px columns); nine tickers in three cadences would bury §02. */
const LANE_PAGE_SIZE = 8;

interface TickerLaneProps {
  lane: Lane;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
  session: MarketSession | null;
  nowMs: number;
  selectedMarketId: MarketId | null;
  onSelect: (marketId: MarketId, side?: Side) => void;
  onOpenRoom: (market: EventMarket) => void;
  /** C6: the roller's lane states without a calendar (`useLaneStates`), for the 24/7 and Gap pauses. */
  laneStates?: Readonly<Record<string, string>> | null;
}


/** One lane's rail, narrowed by the ticker picker and paged. */
export function TickerLane({ lane, ticker, onPick, session, laneStates = null, nowMs, selectedMarketId, onSelect, onOpenRoom }: TickerLaneProps) {
  const pausedStates = pausedInLane(session, laneStates, lane);
  const listed = laneTickers(lane);
  const tickers = TICKER_SYMBOLS.filter((symbol) => listed.includes(symbol) || pausedStates.has(symbol) || symbol === ticker);
  const markets = tickerMarkets(lane, ticker);
  const pager = usePager(markets, LANE_PAGE_SIZE);
  const pausedShown = [...pausedStates].filter(([symbol]) => ticker === null || symbol === ticker);
  const lastPage = pager.page === pager.pageCount - 1;

  return (
    <>
      {(tickers.length > 1 || ticker !== null) && <TickerPicker tickers={tickers} basis={lane.basis} paused={pausedStates} ticker={ticker} onPick={onPick} />}
      {markets.length === 0 && pausedShown.length === 0 ? (
        <EmptyState why={MARKETS.tickers.none(ticker ? laneAssetLabel(ticker, lane.basis) : "", laneCadenceLabel(lane.basis, lane.intervalSec))} />
      ) : (
        <LaneRows
          markets={pager.slice}
          paused={lastPage ? pausedShown : []}
          basis={lane.basis}
          intervalSec={lane.intervalSec}
          nowMs={nowMs}
          selectedMarketId={selectedMarketId}
          onSelect={onSelect}
          onOpenRoom={onOpenRoom}
        />
      )}
      <Pager pager={pager} />
    </>
  );
}
