"use client";

import type { MarketId } from "@agari/core/types";
import { useRef } from "react";
import { presetStake } from "./stake-preset";

/**
 * A verified Window share link's stake (C13a, Blinks on Canton), handed to the ticket through the reference's own
 * one-shot preset (`stake-preset.ts`, the hedge card's path): the ticket that opens on this Window takes it once.
 * Set during the first render, before the ticket mounts, and never again on this mount. Renders nothing.
 */
export function SharedStakePreset({ marketId, stakeBase }: { marketId: MarketId; stakeBase: string }) {
  const done = useRef(false);
  // Browser only: the preset is module state the ticket's effect takes, and server rendering has no ticket to take it.
  if (!done.current && typeof window !== "undefined") {
    done.current = true;
    presetStake(marketId, BigInt(stakeBase));
  }
  return null;
}
