import { describe, expect, it } from "vitest";
import { createRecentRing } from "./recent-ring";
import type { SpotFeed, SpotQuote } from "./spot";

function fakeFeed() {
  const ls = new Set<(q: SpotQuote) => void>();
  const feed: SpotFeed = { latest: () => null, subscribe: (l) => (ls.add(l), () => ls.delete(l)) };
  const push = (atMs: number, price: bigint) => ls.forEach((l) => l({ symbol: "BTC", priceE8: price, publishTimeSec: Math.floor(atMs / 1000), publishTimeMs: atMs, source: "exchange" }));
  return { feed, push };
}

describe("createRecentRing", () => {
  it("keeps the last sample per second, oldest first, within the span", () => {
    const { feed, push } = fakeFeed();
    const ring = createRecentRing(feed, 10);
    push(1_000, 1n);
    push(1_400, 2n);
    push(2_100, 3n);
    expect(ring.points("BTC")).toEqual([[1_400, "2"], [2_100, "3"]]);
    push(13_000, 4n);
    expect(ring.points("BTC")).toEqual([[13_000, "4"]]);
    expect(ring.points("ETH")).toEqual([]);
    ring.stop();
  });
});
