"use client";

import type { MarketPhase } from "@owarine/core/lifecycle";
import { eventLabelOf, isCommitteeMarket } from "@owarine/core/market";
import type { EventMarket } from "@owarine/core/types";
import { Countdown } from "@/components/data";
import { HERO, TICKET } from "@/lib/copy";
import { EVENT_BOARD } from "../events/copy";
import { laneAssetLabel, laneTabLabel } from "../lanes/lane-view";

interface TicketHeaderProps {
  market: EventMarket;
  phase: MarketPhase | null;
  nowMs: number;
}

export function TicketHeader({ market, phase, nowMs }: TicketHeaderProps) {
  // C6e: an event names itself and counts to its lock (when trading ends); a price Window its asset, lane and expiry.
  const event = isCommitteeMarket(market);
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="type-title text-ink">
          {event ? EVENT_BOARD.meta(eventLabelOf(market.asset)) : `${laneAssetLabel(market.asset, market.lane)} · ${laneTabLabel(market.lane, market.intervalSec)}`}
        </span>
        <span className="type-caption text-ink-secondary">{phase ? HERO.phase[phase] : TICKET.syncing}</span>
      </div>
      <Countdown expirySec={event ? market.lockAtSec : market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} className="type-data-lg" />
    </header>
  );
}
