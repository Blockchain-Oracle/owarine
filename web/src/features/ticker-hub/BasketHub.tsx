"use client";

import type { Basket, BasketSymbol } from "@owarine/core/market";
import type { EventMarket, MarketId, Side } from "@owarine/core/types";
import { marketDeepLink } from "@owarine/core/urls";
import { useAssetPrice } from "@owarine/markets/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/chrome";
import { tradingBasketWindow } from "@/features/baskets/basket-window";
import { bpsPct, windowText } from "@/features/baskets/format";
import { basisRaw, feedRawToOracleRaw, pointsLine } from "@/features/markets/hero/units";
import { MarketCard, useLanesState } from "@/features/markets/lanes";
import { SourceLine } from "@/features/markets/price-source/SourceLine";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { BasketMembers } from "./BasketMembers";
import { TICKER_HUB } from "./copy";
import { usePreIpoFacts, type PreIpoFactsView } from "./usePreIpoFacts";

const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

export interface BasketHubViewProps {
  basket: Basket;
  /** The live index at the print scale (points × 10⁸); null before the first read. */
  indexRaw: bigint | null;
  indexStale: boolean;
  facts: PreIpoFactsView | null;
  window: EventMarket | null;
  /** The Window's card, rendered by the caller: the live `MarketCard`, or a canned view on `/dev/basket`. */
  windowCard: ReactNode;
}

/**
 * The hub's basket variant (S19 §5.2, D-081): the facts bar reads Index · Members · Moved instead of a price and a
 * report date; then the members table and the live basket Window.
 * Presentational, so `/dev/basket` renders it from fixtures.
 */
export function BasketHubView({ basket, indexRaw, indexStale, facts, window, windowCard }: BasketHubViewProps) {
  const B = TICKER_HUB.basket;
  const move = facts?.move ?? null;
  return (
    <>
      <div className="prf-bar">
        <dl className="prf-stats">
          <div className="prf-stat">
            <dt title={B.indexHint}>{indexStale ? `${B.index} · ${TICKER_HUB.spotStale}` : B.index}</dt>
            <dd className="big numbers">{indexRaw === null ? TICKER_HUB.dash : pointsLine(indexRaw)}</dd>
          </div>
          <div className="prf-stat">
            <dt>{B.members}</dt>
            <dd className="big">{B.membersLine(basket.members.length)}</dd>
          </div>
          <div className="prf-stat tkh-stat-long">
            <dt>{B.moved(move ? windowText(move.windowSec) : "")}</dt>
            <dd className="big numbers">{move ? B.movedLine(bpsPct(move.rangeBps), signedPct(move.changeBps)) : B.quiet}</dd>
          </div>
        </dl>
        <p className="type-caption text-ink-muted">
          <SourceLine label={assetSourceLabel(basket.symbol, null)} /> · {B.source}
        </p>
      </div>

      <section aria-label={B.table.title}>
        <SectionHeader index="01" title={B.table.title} className="lb-section-head" />
        <BasketMembers basket={basket} members={facts?.members ?? null} />
      </section>

      <section aria-label={B.window.title}>
        <SectionHeader index="02" title={B.window.title} className="lb-section-head" />
        {window ? <div className="tkh-window markets-main">{windowCard}</div> : <p className="news-quiet">{B.window.none}</p>}
      </section>
    </>
  );
}

/** The live basket hub for `/tickers/<BASKET>`: the index from the price stream, the facts row, the trading Window. */
export function BasketHub({ basket }: { basket: Basket }) {
  const symbol: BasketSymbol = basket.symbol;
  const router = useRouter();
  const price = useAssetPrice(symbol);
  const facts = usePreIpoFacts(symbol);
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  const live = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  const factsRow = facts?.ok ? facts.value : null;
  const window = tradingBasketWindow(lanes.laneSet, symbol, nowMs);
  const open = (marketId: MarketId, side?: Side) => router.push(marketDeepLink({ marketId, dir: side }));
  return (
    <BasketHubView
      basket={basket}
      indexRaw={live ?? factsRow?.indexE8 ?? null}
      indexStale={price?.ok === true && price.stale}
      facts={factsRow}
      window={window}
      windowCard={window ? <MarketCard market={window} nowMs={nowMs} selected={false} onSelect={open} onOpenRoom={() => open(window.marketId)} /> : null}
    />
  );
}
