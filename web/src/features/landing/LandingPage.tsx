"use client";

import { HeroEngineProvider } from "./hero/engine";
import { LandingFinal, LandingProof, LandingRoadmap } from "./LandingEnd";
import { LandingHero } from "./LandingHero";
import { LandingLoop, LandingTape } from "./LandingLoop";
import { LandingMarkets } from "./LandingMarkets";
import { LandingPrivate } from "./LandingPrivate";
import "./landing.css";

/**
 * `/` (8 Oct, the "Rainbow" direction): a sky-bright, toy-store landing around Tradash's flow — one line, the
 * tangerine / hot-pink pair, a phone running a real trade on the live price — then the loop it plays, what trades,
 * why nobody sees it, the signed closes, where the product is, and the line again. One live engine
 * (`HeroEngineProvider`) drives the phone and the loop cards. Styles are scoped under `.lp` (landing.css).
 */
export function LandingPage() {
  return (
    <div className="lp min-h-dvh">
      <HeroEngineProvider>
        <LandingHero />
        <LandingTape />
        <LandingLoop />
      </HeroEngineProvider>
      <LandingMarkets />
      <LandingPrivate />
      <LandingProof />
      <LandingRoadmap />
      <LandingFinal />
    </div>
  );
}
