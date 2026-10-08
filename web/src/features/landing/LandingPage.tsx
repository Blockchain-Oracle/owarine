"use client";

import { HeroEngineProvider } from "./hero/engine";
import { LandingFinal, LandingProof, LandingRoadmap } from "./LandingEnd";
import { LandingHero } from "./LandingHero";
import { LandingLoop, LandingTape } from "./LandingLoop";
import { LandingMarkets } from "./LandingMarkets";
import { LandingPrivate } from "./LandingPrivate";
import "./landing.css";

/**
 * `/` (revamp step 3): UGLYCASH's sky and objects around Tradash's landing — one line, one button, a phone running a
 * real trade on the live price — then the loop it plays, why nobody sees it, what trades, the signed closes, where the
 * product is, and the line again. One live engine (`HeroEngineProvider`) drives the phone and the loop cards.
 */
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-ow-canvas text-ow-ink">
      <HeroEngineProvider>
        <LandingHero />
        <LandingTape />
        <LandingLoop />
      </HeroEngineProvider>
      <LandingPrivate />
      <LandingMarkets />
      <LandingProof />
      <LandingRoadmap />
      <LandingFinal />
    </div>
  );
}
