"use client";

import { diagnosisCopy } from "@agari/core/copy";
import type { Diagnosis, EventMarket, MarketId, Side } from "@agari/core/types";
import { EventCard } from "./EventCard";
import { EVENT_BOARD } from "./copy";

interface EventBoardProps {
  /** The lane set's events (`LaneSet.events`); null until the board's one market stream has read. */
  events: readonly EventMarket[] | null;
  /** Why the lane set could not be read, when it could not: said here as the word board above says it, not "reading" for ever. */
  failure?: Diagnosis | null;
  nowMs: number;
  onSelect: (marketId: MarketId, side?: Side) => void;
}

/**
 * The committee events on the board (C6e, K-070), in the word board's grid (`words-grid`, the reference's), soonest lock
 * first. They ride the same market stream as the lanes (`LaneSet.events`), so the board never opens a second one. With
 * none open it says so in the board's own empty line, never an empty space.
 */
export function EventBoard({ events, failure = null, nowMs, onSelect }: EventBoardProps) {
  if (events === null && failure) return <div className="words-empty">{diagnosisCopy(failure.kind).body}</div>;
  if (events === null || nowMs === 0) return <div className="words-empty">{EVENT_BOARD.reading}</div>;
  if (events.length === 0) return <div className="words-empty ev-empty">{EVENT_BOARD.none}</div>;
  return (
    <div className="words-grid ev-grid">
      {events.map((market) => (
        <EventCard key={market.marketId} market={market} nowMs={nowMs} onSelect={onSelect} />
      ))}
    </div>
  );
}
