"use client";

import type { EventMarket } from "@owarine/core/types";
import { ladderSpotSymbol } from "@owarine/markets/react";
import type { Ladder } from "@owarine/markets/runtime";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ChartOverlay } from "@/features/terminal/chart/LiveChart";
import { useCommittedSpot, useWatchedLadder } from "@/features/terminal/live";
import { useGhostTrade, useHeroMarket, type Ghost } from "./useGhostTrade";

export interface HeroEngine {
  nowSec: number;
  symbol: string;
  spotSymbol: string;
  market: EventMarket | null;
  ladder: Ladder | null;
  spot: number | null;
  ghost: Ghost;
  /** The last ride's result, kept while the next one looks for its side. */
  banked: { pnl: number; pnlText: string } | null;
  overlay: RefObject<ChartOverlay | null>;
}

const Ctx = createContext<HeroEngine | null>(null);

function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * One live engine for the whole landing: the market the hero runs, its ladder and spot, and the paper trade playing on
 * them. The hero's phone draws it; the "how it works" cards narrate the same trade.
 */
export function HeroEngineProvider({ children }: { children: ReactNode }) {
  const nowSec = useNowSec();
  const { symbol, market } = useHeroMarket(nowSec);
  const ladder = useWatchedLadder(market ? { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals } : null)?.ladder ?? null;
  const spotSymbol = ladder ? (ladderSpotSymbol(ladder) ?? symbol) : symbol;
  const spot = useCommittedSpot(spotSymbol);
  const overlay = useRef<ChartOverlay | null>(null);
  const ghost = useGhostTrade(market, spotSymbol, overlay);
  const [banked, setBanked] = useState<HeroEngine["banked"]>(null);
  useEffect(() => {
    if (ghost.phase === "bank") setBanked({ pnl: ghost.pnl, pnlText: ghost.pnlText });
  }, [ghost.phase, ghost.pnl, ghost.pnlText]);
  return <Ctx.Provider value={{ nowSec, symbol, spotSymbol, market, ladder, spot, ghost, banked, overlay }}>{children}</Ctx.Provider>;
}

export function useHeroEngine(): HeroEngine {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHeroEngine outside HeroEngineProvider");
  return v;
}
