import type { EventMarket, MarketId } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { placedWindowOf } from "./placed-window";

/** C11b: the fill landed in BTC-1m:34 while the ticket had already advanced to :35 (cutoff T+20, fill T+21). */
const windowOf = (id: string, expirySec: number) => ({ marketId: id as MarketId, expirySec }) as unknown as EventMarket;
const W34 = windowOf("w34", 1_791_276_600);
const W35 = windowOf("w35", 1_791_276_660);

describe("placedWindowOf: The Call describes the order's Window, never the one the ticket moved to", () => {
  it("keeps the Window in hand when the order landed there", () => {
    expect(placedWindowOf(W34.marketId, W34, null)).toBe(W34);
  });

  it("reads the order's Window when the ticket advanced during the hold", () => {
    expect(placedWindowOf(W34.marketId, W35, W34)?.expirySec).toBe(1_791_276_600);
  });

  it("shows nothing rather than the advanced Window while the order's Window is unread", () => {
    expect(placedWindowOf(W34.marketId, W35, null)).toBeNull();
    expect(placedWindowOf(W34.marketId, W35, W35)).toBeNull();
  });
});
