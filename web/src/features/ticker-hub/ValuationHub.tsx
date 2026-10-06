"use client";

import { TICKERS, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/chrome";
import { tradingBasketWindow } from "@/features/baskets/basket-window";
import { usdLine } from "@/features/markets/hero/units";
import { MarketCard, useLanesState } from "@/features/markets/lanes";
import { SourceLine } from "@/features/markets/price-source/SourceLine";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { tickerHref } from "@/features/takes/cashtags";
import { TICKER_HUB } from "./copy";
import type { IndexState } from "./index-state";

export interface ValuationHubViewProps {
  symbol: TickerSymbol;
  /** Null while the first entitlement read is in flight. */
  state: IndexState | null;
  window: EventMarket | null;
  /** The Window's card, rendered by the caller: the live `MarketCard`, or a canned view on `/dev/pyth-index`. */
  windowCard: ReactNode;
}

/**
 * The hub's valuation variant (S20, D-125, C8d): while ops' probe says the venue may read Pyth's index, the bar reads
 * Pyth index · Token price · Token vs Pyth · Index age, then the lane's live Window. While it may not, the hub names the
 * gate and why (D-015), with a way to the token's own hub, and nothing that looks like a lane. Presentational, so
 * `/dev/pyth-index` renders both states from fixtures.
 */
export function ValuationHubView({ symbol, state, window, windowCard }: ValuationHubViewProps) {
  const V = TICKER_HUB.valuation;
  const ticker = TICKERS[symbol];
  const company = ticker.valuationOf ? TICKERS[ticker.valuationOf].name : ticker.name;
  const tokenLink = (className: string) =>
    ticker.valuationOf ? (
      <Link href={tickerHref(ticker.valuationOf)} className={className} data-cursor="hover">
        {V.tokenHub(company)} →
      </Link>
    ) : null;
  if (state === null) {
    return (
      <div className="prf-bar" aria-busy>
        <p className="news-quiet" role="status">
          {TICKER_HUB.dash}
        </p>
      </div>
    );
  }
  if (state.kind === "absent") {
    return (
      <section className="capability-pending tkh-pending-lane" aria-label={V.pendingTitle(ticker.name)}>
        <p className="cp-eyebrow">{V.laneEyebrow}</p>
        <h2 className="cp-title">{V.pendingTitle(ticker.name)}</h2>
        <div className="cp-body">
          <p>{V.pendingBody(state.why)}</p>
        </div>
        <p className="cp-meta">Not connected yet · waiting on {state.gate}</p>
        {tokenLink("cp-action")}
      </section>
    );
  }
  const { row } = state;
  return (
    <>
      <div className="prf-bar">
        <dl className="prf-stats">
          <div className="prf-stat">
            <dt title={V.indexHint}>{row.fresh ? V.index : `${V.index} · ${TICKER_HUB.spotStale}`}</dt>
            <dd className="big numbers">{usdLine(row.indexE8)}</dd>
          </div>
          <div className="prf-stat">
            <dt>{V.token}</dt>
            <dd className="big numbers">{row.tokenPriceE8 === null ? TICKER_HUB.dash : usdLine(row.tokenPriceE8)}</dd>
          </div>
          <div className="prf-stat">
            <dt>{V.tokenVsIndex}</dt>
            <dd className="big numbers">{row.premiumBps === null ? TICKER_HUB.dash : TICKER_HUB.preIpo.premiumLine(row.premiumBps)}</dd>
          </div>
          <div className="prf-stat">
            <dt>{V.age}</dt>
            <dd className="big numbers">{V.ageLine(row.ageSec)}</dd>
          </div>
        </dl>
        <p className="type-caption text-ink-muted">
          <SourceLine label={assetSourceLabel(symbol, null)} /> · {V.source}
        </p>
        <div className="prf-actions">
          {tokenLink("asset-tab")}
          <Link href="/markets" className="asset-tab" data-cursor="hover">
            {TICKER_HUB.trade}
          </Link>
        </div>
      </div>
      <section aria-label={V.window.title}>
        <SectionHeader index="01" title={V.window.title} className="lb-section-head" />
        {window ? <div className="tkh-window markets-main">{windowCard}</div> : <p className="news-quiet">{V.window.none}</p>}
      </section>
    </>
  );
}

/** The live valuation hub for `/tickers/<OPENAIV>`: the entitlement read, and the lane's trading Window while it is listed. */
export function ValuationHub({ symbol, state }: { symbol: TickerSymbol; state: IndexState | null }) {
  const router = useRouter();
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  const window = state?.kind === "readable" ? tradingBasketWindow(lanes.laneSet, symbol, nowMs) : null;
  const open = (marketId: MarketId, side?: Side) => router.push(marketDeepLink({ marketId, dir: side }));
  return (
    <ValuationHubView
      symbol={symbol}
      state={state}
      window={window}
      windowCard={window ? <MarketCard market={window} nowMs={nowMs} selected={false} onSelect={open} onOpenRoom={() => open(window.marketId)} /> : null}
    />
  );
}
