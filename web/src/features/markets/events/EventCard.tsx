"use client";

import { eventLabelOf } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatWallClock } from "@agari/core/units";
import { marketPath } from "@agari/core/urls";
import Link from "next/link";
import { Countdown } from "@/components/data";
import { MARKETS, WORD_BOARD } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { AssetDisc } from "../hero/asset-mark";
import { useTopOfBook } from "../hero/useTopOfBook";
import { impliedUpShare } from "../word-board/WordCard";
import { EVENT_BOARD, EVENT_SIDE_WORD } from "./copy";

interface EventCardProps {
  market: EventMarket;
  nowMs: number;
  /** Selects this Window with a side: the ticket opens on it (the rail on desktop, the drawer on a phone). */
  onSelect: (marketId: MarketId, side?: Side) => void;
}

const cents = (value: number | null, hydrating: boolean): string => (value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`);

/**
 * One committee event as a card on the board (C6e, K-070) — the reference's word card (`WordCard`, itself Yosuku's
 * `WordMarketBoard` question card) with the event's own question in place of the price question. The kit is unchanged:
 * the same `wq-*` card, odds bar and YES/NO buttons. A tap is the choice, as on the lane cards: it selects this Window
 * with its side, so the ticket opens on it and an event is placed from the board exactly as a price Window is. "Open"
 * is the event's own page (`/markets/<id>`).
 *
 * What differs is what an event is: no ticker, no chart, no opening print. The clock counts to the lock (when trading
 * ends), the row under the bar says when the committee answers, and a locked event says so instead of offering prices.
 */
export function EventCard({ market, nowMs, onSelect }: EventCardProps) {
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const nowSec = Math.floor(nowMs / 1000);
  const upcoming = nowMs > 0 && nowSec < market.tradingStartSec;
  const locked = nowMs > 0 && nowSec >= market.lockAtSec;
  const share = impliedUpShare(upCents, downCents);
  const unquoted = !hydrating && upCents === null && downCents === null;
  const label = eventLabelOf(market.asset);
  const href = () => marketPath(market.marketId);

  return (
    <div className="wq-card ev-card" data-event={market.asset}>
      <div className="wq-top">
        <AssetDisc asset={label} className="wq-btc" />
        <span className="wq-meta">{EVENT_BOARD.meta(label)}</span>
        <span className="wq-kind">{EVENT_BOARD.committee}</span>
        {!locked && (
          <Countdown
            expirySec={upcoming ? market.tradingStartSec : market.lockAtSec}
            intervalSec={Math.max(60, market.lockAtSec - market.tradingStartSec)}
            nowMs={nowMs}
            className="wq-clock"
          />
        )}
      </div>

      <p className="wq-q">
        <Link href={href()} className="ev-q-link" data-cursor="hover">
          {market.question}
        </Link>
      </p>

      {!locked && !unquoted && (
        <>
          {share === null ? (
            <div className="wq-oddsbar wq-oddsbar-unknown" aria-hidden />
          ) : (
            <div className="wq-oddsbar" aria-hidden>
              <div className="wq-oddsfill" style={{ width: `${share}%` }} />
            </div>
          )}
          <div className="wq-oddsrow">
            <span className="wq-close">
              {upcoming ? EVENT_BOARD.opens(formatWallClock(market.tradingStartSec * 1000)) : EVENT_BOARD.locks(formatWallClock(market.lockAtSec * 1000))}
            </span>
            <span className="wq-yeslead">{share === null ? WORD_BOARD.noLean : WORD_BOARD.implied(share)}</span>
          </div>
        </>
      )}

      {locked ? (
        <div className="wq-unquoted">
          <span className="wq-unquoted-dot" aria-hidden />
          <span className="wq-unquoted-text">{EVENT_BOARD.answers(formatWallClock(market.expirySec * 1000))}</span>
          <Link className="wq-unquoted-open" href={href()}>
            {EVENT_BOARD.open}
          </Link>
        </div>
      ) : unquoted ? (
        <div className="wq-unquoted">
          <span className="wq-unquoted-dot" aria-hidden />
          <span className="wq-unquoted-text">{CLOSED.noQuotes}</span>
          <Link className="wq-unquoted-open" href={href()}>
            {EVENT_BOARD.open}
          </Link>
        </div>
      ) : (
        <div className="wq-actions">
          <button type="button" className="wq-btn yes" onClick={() => onSelect(market.marketId, "up")} aria-label={`${EVENT_SIDE_WORD.up}: ${market.question}`} data-cursor="hover">
            <span className="wq-side">{EVENT_SIDE_WORD.up}</span>
            <span className="wq-cents">{cents(upCents, hydrating)}</span>
          </button>
          <button type="button" className="wq-btn no" onClick={() => onSelect(market.marketId, "down")} aria-label={`${EVENT_SIDE_WORD.down}: ${market.question}`} data-cursor="hover">
            <span className="wq-side">{EVENT_SIDE_WORD.down}</span>
            <span className="wq-cents">{cents(downCents, hydrating)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
