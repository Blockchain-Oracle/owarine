import type { EventMarket } from "@owarine/core/types";
import type { DeskReelDecision } from "@/features/desk/DeskReelCard";
import type { FeedTake } from "./protocol";

export type ReelItem = { kind: "market"; market: EventMarket } | { kind: "take"; take: FeedTake } | { kind: "desk"; decision: DeskReelDecision };

/** The desk's latest notable decision sits this many items in (plan §5.2 "occasional"), or last in a short feed. */
export const DESK_AT = 4;

/**
 * Weave community takes into the live-market reel so the snap scroll is one stream
 * of live Windows and social calls: market, take, market, take… then whichever list
 * has a tail. Starting on a live Window keeps the first card actionable — the
 * reference's own rule (`app/reels/page.tsx` L40–53), verbatim.
 */
export function weaveReel(rounds: readonly EventMarket[], takes: readonly FeedTake[], desk: DeskReelDecision | null = null): ReelItem[] {
  const woven: ReelItem[] = [];
  const max = Math.max(rounds.length, takes.length);
  for (let i = 0; i < max; i += 1) {
    const market = rounds[i];
    const take = takes[i];
    if (market) woven.push({ kind: "market", market });
    if (take) woven.push({ kind: "take", take });
  }
  if (!desk || woven.length === 0) return woven;
  const at = Math.min(DESK_AT, woven.length);
  return [...woven.slice(0, at), { kind: "desk", decision: desk }, ...woven.slice(at)];
}
