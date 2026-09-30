"use client";

import { eventLabelOf } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatWallClock } from "@agari/core/units";
import { Countdown } from "@/components/data";
import { WORD_BOARD } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AssetDisc } from "../hero/asset-mark";
import { HeroYesNo } from "../hero/HeroYesNo";
import { useTopOfBook } from "../hero/useTopOfBook";
import { impliedUpShare } from "../word-board/WordCard";
import { eventClockOf } from "./clock";
import { EVENT_BOARD, EVENT_SIDE_WORD } from "./copy";

interface EventHeroProps {
  market: EventMarket;
  nowMs: number;
  onSelect: (marketId: MarketId, side: Side) => void;
}

/**
 * The hero for a committee event (C6e, K-070): the event's own page and the board's selection. The price hero's frame
 * (`hero-chart`, its head row, the question line, the clock block and the phone's YES/NO) holds the event's question in
 * place of the price question. An event has no chart and no opening print, so the canvas holds what a reader needs
 * instead: the book's lean and how the committee settles it. The ticket beside it is the same ticket.
 */
export function EventHero({ market, nowMs, onSelect }: EventHeroProps) {
  const book = useTopOfBook(market);
  const label = eventLabelOf(market.asset);
  const { locked, spanSec, urgent } = eventClockOf(market, nowMs);
  const share = impliedUpShare(book.upCents, book.downCents);

  return (
    <div className="hero-chart ev-hero" data-event={market.asset}>
      <div className="hero-chart-head">
        <div>
          <div className="mh-asset-row">
            <AssetDisc asset={label} className="mh-asset-badge" />
            <span className="mh-asset-label">{EVENT_BOARD.meta(label)}</span>
            <span className="ev-chip">{EVENT_BOARD.committee}</span>
          </div>
          <h2 className="mh-question">{market.question}</h2>
          <span className="pair-meta">{EVENT_BOARD.answers(formatWallClock(market.expirySec * 1000))}</span>
        </div>
        <div className={cn("mh-settles", urgent && "urgent")}>
          <span className="mh-settles-label">{EVENT_BOARD.endsIn}</span>
          {locked ? (
            <span className="mh-settles-value numbers">00:00</span>
          ) : (
            <Countdown expirySec={market.lockAtSec} intervalSec={spanSec} nowMs={nowMs} announce className="mh-settles-value" />
          )}
        </div>
      </div>

      <div className="hero-chart-canvas ev-hero-body">
        {locked ? (
          <p className="ev-hero-note" role="status">
            {EVENT_BOARD.locked}
          </p>
        ) : (
          <div className="ev-hero-lean">
            {share === null ? (
              <div className="wq-oddsbar wq-oddsbar-unknown" aria-hidden />
            ) : (
              <div className="wq-oddsbar" aria-hidden>
                <div className="wq-oddsfill" style={{ width: `${share}%` }} />
              </div>
            )}
            <div className="wq-oddsrow">
              <span className="wq-close">{EVENT_BOARD.locks(formatWallClock(market.lockAtSec * 1000))}</span>
              <span className="wq-yeslead">{share === null ? WORD_BOARD.noLean : WORD_BOARD.implied(share)}</span>
            </div>
          </div>
        )}
        <div className="ev-hero-how">
          <span className="ev-hero-how-label">{EVENT_BOARD.howItSettles}</span>
          <ol className="ev-hero-steps">
            {EVENT_BOARD.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      {!locked && <HeroYesNo marketId={market.marketId} upCents={book.upCents} downCents={book.downCents} onSelect={onSelect} words={EVENT_SIDE_WORD} />}
    </div>
  );
}
