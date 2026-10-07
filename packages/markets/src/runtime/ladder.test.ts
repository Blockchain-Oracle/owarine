import type { QuoteTarget } from "@owarine/core/ports";
import type { Address, MarketId } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import type { SeriesFacts } from "./accounts";
import { ladderBookState, parseLadder } from "./ladder";
import { quoteFromBook, toBookDepth } from "./mappers";

const NOW = 1_790_657_300;
/** The Canton grid the venue runs: cash unit 1,000 base units, so a lot is one whole contract (10⁶) and a tick 1,000. */
const series: SeriesFacts = {
  address: "JDJZRfApSz6uZzQrQ1h1CBUavbHbgX5mKgyChVBMu5L6" as Address,
  symbol: "BTC", basis: 0, cadenceSec: 300, lotBase: 1_000_000n, tickBase: 1_000n, cashUnit: 1_000n, minLots: 1n,
  seatBond: 0n, fillsCap: 0, evictionsCap: 0, minRestSlots: 0n, policySources: [{ primary: 0, check: 0 }, { primary: 4, check: 0 }],
};

/** ops' `WireLadder` as `/ladders/latest` sends it (lots as strings). */
const wire = (over: Record<string, unknown> = {}) => ({
  marketId: "2d33xRnEp4mn4ULsukD4dwbMm9QVXhhUA7oSsbi38jDS",
  damlMarketId: "BTC-5m:3",
  seriesId: series.address,
  termsCid: "00ea75ad",
  seriesKey: "BTC-5m",
  symbol: "BTC",
  index: 3,
  tradingStartSec: NOW - 200,
  lockAtSec: NOW + 70,
  expirySec: NOW + 100,
  quotingUntilSec: NOW + 40,
  cashUnit: "1000",
  feeRateBps: 100,
  fairTicks: 321,
  up: [[351, "200"], [356, "200"]],
  down: [[709, "200"], [714, "100"]],
  asOfMs: NOW * 1000,
  state: "quoting",
  ...over,
});
const target: QuoteTarget = { marketId: "2d33xRnEp4mn4ULsukD4dwbMm9QVXhhUA7oSsbi38jDS" as MarketId, poolAddress: "00ea75ad" as QuoteTarget["poolAddress"], decimals: 6, intervalSec: 300 };

describe("the venue ladder as a walkable Book", () => {
  it("parses ops' wire ladder and drops what does not parse", () => {
    expect(parseLadder(wire())?.up).toEqual([[351, 200n], [356, 200n]]);
    expect(parseLadder({ ...wire(), up: [[0, "5"]] })).toBeNull();
    expect(parseLadder({ nope: true })).toBeNull();
  });

  it("buys Up at the up levels and Down at the down levels, each in its own terms", () => {
    const depth = toBookDepth(ladderBookState(parseLadder(wire())!), series, 6, NOW);
    expect(depth.upAsks).toEqual([
      { priceRaw: 351_000n, priceBps: 3_510, quantityRaw: 200_000_000n },
      { priceRaw: 356_000n, priceBps: 3_560, quantityRaw: 200_000_000n },
    ]);
    expect(depth.downAsks).toEqual([
      { priceRaw: 709_000n, priceBps: 7_090, quantityRaw: 200_000_000n },
      { priceRaw: 714_000n, priceBps: 7_140, quantityRaw: 100_000_000n },
    ]);
    // Down's asks are the YES bids at 1000 − p; the ladder publishes no Up sell side beyond them.
    expect(depth.upBids.map((l) => l.priceBps)).toEqual([2_910, 2_860]);
  });

  it("quotes the ticket's stake off the ladder, and a whole-lot remainder is rounding, not a thin book", () => {
    const book = ladderBookState(parseLadder(wire())!);
    const up = quoteFromBook(book, series, target, "up", 5_000_000n, NOW)!;
    expect(up.side).toBe("up");
    expect(up.oddsCents).toBe(35);
    expect(up.contractsRaw % series.lotBase).toBe(0n);
    expect(up.partial).toBe(false);
    const down = quoteFromBook(book, series, target, "down", 5_000_000n, NOW)!;
    expect(down.oddsCents).toBe(71);
    expect(down.partial).toBe(false);
    // More than both Down levels can hold at the padded limit is a thin book, said as partial.
    expect(quoteFromBook(book, series, target, "down", 1_000_000_000n, NOW)!.partial).toBe(true);
  });

  it("has nothing to walk once quoting is over or the Window stops quoting", () => {
    const expired = ladderBookState(parseLadder(wire({ quotingUntilSec: NOW }))!);
    expect(toBookDepth(expired, series, 6, NOW).upAsks).toEqual([]);
    const closed = ladderBookState(parseLadder(wire({ state: "closed" }))!);
    expect(quoteFromBook(closed, series, target, "up", 5_000_000n, NOW)).toBeNull();
  });
});
