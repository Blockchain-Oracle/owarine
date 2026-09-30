import { costBpsFor, MAX_COST_BPS } from "@agari/core/desk";
import { DESK_LOT_MULTIPLIER_E12, DESK_MINTS, lotPriceE8, quoteSwap, USDC_MAINNET } from "@agari/markets/desk/server";
import type { Ladder } from "@agari/markets/runtime";
import { describe, expect, it } from "vitest";
import { liveCostBps } from "./market";

/** C8i's drive: OPENAI-60m:1 quoted fair 562, ask 592 (the venue's 30-tick half-spread), 200 lots a level. */
const ladder = {
  marketId: "56DQDUWGsrE5ezUtyzCqFkwZmCk9ELW7ijghgFETzqMC", damlMarketId: "OPENAI-60m:1", termsCid: "00terms", seriesKey: "OPENAI-60m", symbol: "OPENAI", index: 1,
  tradingStartSec: 1_790_748_000, lockAtSec: 1_790_751_480, expirySec: 1_790_751_600, quotingUntilSec: 1_790_751_480, cashUnit: 1000n, feeRateBps: 100, fairTicks: 562,
  up: [[592, 200n], [597, 200n]], down: [[468, 200n], [473, 200n]], asOfMs: 0, state: "quoting",
} as unknown as Ladder;

describe("a live buy's cost is measured against its own price (C8i)", () => {
  it("a 20-credit OpenAI buy costs the venue's 1% fee against the ask, under the 2.5% limit", async () => {
    const quote = await quoteSwap({ inputMint: USDC_MAINNET, outputMint: DESK_MINTS.OPENAI, amount: 20_000_000n, slippageBps: 200, ladders: [ladder] });
    const cost = liveCostBps("buy", 20_000_000n, quote.outAmount, 592, 562, 1000n);
    expect(cost).not.toBeNull();
    expect(cost!).toBeGreaterThanOrEqual(99);
    expect(cost!).toBeLessThanOrEqual(MAX_COST_BPS);
    // Against the fair price the same fill counts the half-spread too: every live buy read as too costly.
    expect(costBpsFor("buy", 20_000_000n, quote.outAmount, lotPriceE8(562, 1000n), DESK_LOT_MULTIPLIER_E12)).toBeGreaterThan(MAX_COST_BPS);
  });

  it("has no cost without a quote", () => {
    expect(liveCostBps("buy", 20_000_000n, 0n, 592, 562, 1000n)).toBeNull();
    expect(liveCostBps("buy", 20_000_000n, 5n, null, null, 1000n)).toBeNull();
  });
});
