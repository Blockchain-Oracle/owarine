"use client";

import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { SectionHeader } from "@/components/chrome";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { usdLine } from "@/features/markets/hero/units";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { MarketCardView } from "@/features/markets/lanes";
import type { IndexState } from "@/features/ticker-hub/index-state";
import { PreIpoStats, type PreIpoStatsProps } from "@/features/ticker-hub/PreIpoStats";
import { ValuationHubView } from "@/features/ticker-hub/ValuationHub";
import { CLOCK } from "../session/market-session-fixtures";
import { Fixture } from "../states/_sections/Fixture";
import { OPENAI_DENIED, OPENAI_FACTS, OPENAI_INDEX, OPENAI_READABLE, OPENAI_SPOT_E8, OPENAIV_CARD, OPENAIV_WINDOW } from "./fixtures";
import "@/features/profile/profile.css";
import "@/features/ticker-hub/ticker-hub.css";

const SYMBOL = "OPENAI" as const;

/** The hub's head and figure bar as `/tickers/OPENAI` lays them out, over canned readings. */
function HubBar(props: PreIpoStatsProps) {
  const ticker = TICKERS[SYMBOL];
  return (
    <div className="news-page prf-page tkh-page">
      <div className="news-inner">
        <div className="news-live tkh-live">
          <span className="news-live-label">{TICKER_HUB.eyebrow(ticker.kind)}</span>
        </div>
        <h1 className="news-title tkh-title">
          <AssetDisc asset={SYMBOL} className="tkh-mark" />
          <span>
            {ticker.name} <span className="vermilion">${SYMBOL}</span>
          </span>
        </h1>
        <p className="news-intro">{props.index ? TICKER_HUB.preIpo.introBoth(ticker.name) : TICKER_HUB.preIpo.intro(ticker.name)}</p>
        <div className="prf-bar">
          <PreIpoStats {...props} />
        </div>
      </div>
    </div>
  );
}

const VALUATION: TickerSymbol = "OPENAIV";
const noop = () => {};

/** `/tickers/OPENAIV` as the live hub lays it out (C8d), over a canned entitlement reading. */
function ValuationBar({ state }: { state: IndexState }) {
  const ticker = TICKERS[VALUATION];
  const V = TICKER_HUB.valuation;
  const listed = state.kind === "readable";
  return (
    <div className="news-page prf-page tkh-page">
      <div className="news-inner">
        <div className="news-live tkh-live">
          <span className="news-live-label">{TICKER_HUB.eyebrow(ticker.kind)}</span>
        </div>
        <h1 className="news-title tkh-title">
          <AssetDisc asset={VALUATION} className="tkh-mark" />
          <span>
            {ticker.name} <span className="vermilion">${VALUATION}</span>
          </span>
        </h1>
        <p className="news-intro">{listed ? V.intro(ticker.name, TICKERS[SYMBOL].name) : V.introAbsent(ticker.name, TICKERS[SYMBOL].name)}</p>
        <ValuationHubView
          symbol={VALUATION}
          state={state}
          window={listed ? OPENAIV_WINDOW : null}
          windowCard={listed ? <MarketCardView market={OPENAIV_WINDOW} nowMs={CLOCK.weekendSat * 1000} selected={false} onSelect={noop} onOpenRoom={noop} {...OPENAIV_CARD} /> : null}
        />
      </div>
    </div>
  );
}

export function PythIndexFixtures() {
  const spot = usdLine(OPENAI_SPOT_E8);
  const source = assetSourceLabel(SYMBOL, null);
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="S20" title={TICKER_HUB.dev.title} />
      <p className="type-body text-ink-secondary">{TICKER_HUB.dev.intro}</p>
      <Fixture label={TICKER_HUB.dev.withoutIndex}>
        <HubBar spot={spot} spotStale={false} facts={OPENAI_FACTS} index={null} source={source} indexAbsentWhy={OPENAI_DENIED.kind === "absent" ? OPENAI_DENIED.why : null} />
      </Fixture>
      <Fixture label={TICKER_HUB.dev.withIndex}>
        <HubBar spot={spot} spotStale={false} facts={OPENAI_FACTS} index={OPENAI_INDEX} source={source} />
      </Fixture>
      <Fixture label={TICKER_HUB.dev.valuationAbsent}>
        <ValuationBar state={OPENAI_DENIED} />
      </Fixture>
      <Fixture label={TICKER_HUB.dev.valuationListed}>
        <ValuationBar state={OPENAI_READABLE} />
      </Fixture>
    </div>
  );
}
