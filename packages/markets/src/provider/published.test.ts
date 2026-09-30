import type { MarketLedger } from "@agari/core/projection";
import type { MarketId, Signature } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import type { MarketRow } from "./index-api";
import { publishedOpenPosition } from "./published";

/** 2 lots Up at 600 ticks: lotBase 1e6 raw, tickBase 1e3 raw, 6 decimals, so the stake is 1.2 credits. */
const ledger: MarketLedger = {
  marketId: "m1" as MarketId, heldUpRaw: 2_000_000n, heldDownRaw: 0n, costBase: 1_200_000n, proceedsBase: 0n, sidesTraded: [0],
  fillCount: 1, shortCount: 0, firstAtMs: 0, lastAtMs: 0, entryTxHash: "u1" as Signature,
};
const row = (lastPriceTicks: number | null) =>
  ({ market: "m1", symbol: "BTC", cadence_sec: 60, expiry_sec: "1790000060", tick_base: "1000", lot_base: "1000000", last_price_ticks: lastPriceTicks }) as unknown as MarketRow;

describe("another seat's published open call", () => {
  it("is marked at the Window's last price where the venue shows it (k >= 5)", () => {
    const p = publishedOpenPosition({ ledger, row: row(700) }, 6);
    expect(p).toMatchObject({ marketId: "m1", asset: "BTC", balanceUpRaw: 2_000_000n, costBasisBase: 1_200_000n, markValueBase: 1_400_000n, unrealizedPnlBase: 200_000n });
  });

  it("claims no P&L when no price is public: the value is the stake", () => {
    const p = publishedOpenPosition({ ledger, row: row(null) }, 6);
    expect(p).toMatchObject({ markValueBase: 1_200_000n, unrealizedPnlBase: 0n });
  });
});
