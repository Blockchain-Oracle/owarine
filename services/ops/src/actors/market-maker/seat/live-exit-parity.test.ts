/**
 * Revamp step 2: the client's live PnL and Close come from one kernel. A ladder built the way the pricer builds it, sent
 * through the wire and parsed by the client, gives the client exactly the proceeds the exit issuer would firm-quote.
 */
import { CALENDAR_YEAR_SEC, fairYesTicks } from "@owarine/core/market";
import { bidLevels, walkExit } from "@owarine/markets/ops/canton";
import { livePnl, parseLadder } from "@owarine/markets/runtime";
import { describe, expect, it } from "vitest";
import { buildLadder } from "./ladder";
import { toWireLadder, type LadderEntry } from "./ladder-board";

describe("live exit parity with the exit issuer", () => {
  it.each([
    ["flat", 10_000n],
    ["up 0.2%", 10_020n],
    ["down 0.3%", 9_970n],
  ])("%s", (_, bps) => {
    const now = 1_791_370_000;
    const open = 8_376_100_000_000n;
    const spot = (open * bps) / 10_000n;
    const fair = fairYesTicks({ spotE8: spot, openE8: open, secondsLeft: 45, sigmaBps: 4500, yearSec: CALENDAR_YEAR_SEC, minTick: 10 });
    const ladder = buildLadder({ fairTicks: fair, halfSpreadTicks: 30, minTick: 10, levels: 5, stepTicks: 5, lotsPerLevel: 200n, cashUnit: 1000n, capBase: 5_000_000_000n, usedUpBase: 0n, usedDownBase: 0n });
    const entry: LadderEntry = {
      marketId: "m", damlMarketId: "BTC-1m:1", seriesId: "s", termsCid: "t", seriesKey: "k", symbol: "BTC", index: 1, tradingStartSec: now - 15, lockAtSec: now + 45,
      expirySec: now + 45, quotingUntilSec: now + 30, cashUnit: 1000n, feeRateBps: 100, fairTicks: fair, sigmaBps: 4500, yearSec: CALENDAR_YEAR_SEC, minTick: 10,
      halfSpreadTicks: 30, openPriceE8: open, spotE8: spot, up: ladder.up, down: ladder.down, asOfMs: now * 1000, state: "quoting",
    };
    const parsed = parseLadder(JSON.parse(JSON.stringify(toWireLadder(entry))))!;
    for (const side of ["up", "down"] as const) {
      const lots = 333n;
      const contracts = lots * 1000n * 1000n;
      const live = livePnl({ ladder: parsed, spotE8: spot, nowSec: now, upContractsRaw: side === "up" ? contracts : 0n, downContractsRaw: side === "down" ? contracts : 0n, costBasisBase: 0n });
      expect(live.exitBase).toBe(walkExit(bidLevels(entry, side), lots, entry.cashUnit)!.proceedsBase);
    }
  });
});
