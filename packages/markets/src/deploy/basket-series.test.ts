import { describe, expect, it } from "vitest";
import { BASKET_SYMBOLS, BASKETS, type Basket } from "@owarine/core/market";
import { preStocksBasketFeedHex } from "../prices/prestocks";
import { SOURCE, ZERO_POLICY } from "./policies";
import { BASIS, preStocksBasketFeedId, preStocksBasketSeries } from "./venue-spec";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("preStocksBasketSeries", () => {
  it("is a token-basis attested Series on the basket's own ticker id and feed, keyed like every token Series", () => {
    const spec = preStocksBasketSeries(BASKETS.AILABS);
    expect(spec).toMatchObject({ key: "AILABS-60m", symbol: "AILABS", ticker: 920, cadenceSec: 3_600, basis: BASIS.token, books: { count: 2, capacity: 256 } });
    expect(spec.versions).toHaveLength(1);
    const [v] = spec.versions;
    expect(v!.primary.source).toBe(SOURCE.attested);
    expect(hex(v!.primary.feedId as Uint8Array)).toBe(preStocksBasketFeedHex("AILABS"));
    expect(hex(preStocksBasketFeedId("PREALL"))).toBe(preStocksBasketFeedHex("PREALL"));
    // Single-source, like a name (D-101): the zero check policy and no divergence.
    expect(v!.check).toEqual(ZERO_POLICY);
    expect(v!.maxDivergenceBps).toBe(0);
    expect(preStocksBasketSeries(BASKETS.PREDMKTS, 900).key).toBe("PREDMKTS-15m");
  });

  it("names the feed by version, distinct from a name's feed and from a re-based v2", () => {
    const ascii = (h: string) => String.fromCharCode(...h.match(/../g)!.map((b) => Number.parseInt(b, 16))).replace(/\0+$/, "");
    expect(ascii(preStocksBasketFeedHex("AILABS"))).toBe("prestocks-basket-v1:AILABS");
    expect(new Set(BASKET_SYMBOLS.map(preStocksBasketFeedHex)).size).toBe(BASKET_SYMBOLS.length);
  });

  it("refuses to describe a Series for a basket with no base: nothing registers without one", () => {
    const unbased: Basket = { ...BASKETS.AILABS, members: BASKETS.AILABS.members.map((m, i) => (i === 0 ? { ...m, basePriceE8: null } : m)) };
    expect(() => preStocksBasketSeries(unbased)).toThrow(/AILABS has no base for OPENAI/);
    expect(() => preStocksBasketSeries({ ...BASKETS.AILABS, baseAtSec: null })).toThrow(/has no base/);
  });
});
