import { CALENDAR_YEAR_SEC, fairYesTicks } from "@owarine/core/market";
import { describe, expect, it } from "vitest";
import { bidLevels, walkExit } from "../ops/canton/quote-walk";
import { parseLadder, type Ladder } from "./ladder";
import { fairNow, liveExit, livePnl, lotsOf, repriceLadder } from "./live-exit";

const CU = 1000n;
const NOW = 1_791_370_000;
const OPEN = 8_376_100_000_000n;

function ladder(o: Partial<Record<string, unknown>> = {}): Ladder {
  const fair = fairYesTicks({ spotE8: OPEN, openE8: OPEN, secondsLeft: 40, sigmaBps: 4000, yearSec: CALENDAR_YEAR_SEC, minTick: 10 });
  return parseLadder({
    marketId: "m1", damlMarketId: "BTC-1m:1", seriesId: "s", termsCid: "t", seriesKey: "k", symbol: "BTC", index: 1,
    tradingStartSec: NOW - 20, lockAtSec: NOW + 40, expirySec: NOW + 40, quotingUntilSec: NOW + 25, cashUnit: CU.toString(), feeRateBps: 100,
    fairTicks: fair, sigmaBps: 4000, yearSec: CALENDAR_YEAR_SEC, minTick: 10, halfSpreadTicks: 30, openPriceE8: OPEN.toString(), spotE8: OPEN.toString(),
    up: [[fair + 30, "200"], [fair + 35, "200"]], down: [[1000 - (fair - 30), "200"], [1000 - (fair - 30) + 5, "200"]], asOfMs: NOW * 1000, state: "quoting", ...o,
  })!;
}

describe("repriceLadder", () => {
  it("leaves the ladder as published when spot is the one it was priced on", () => {
    const l = ladder();
    const r = repriceLadder(l, OPEN, NOW);
    expect(r.shiftTicks).toBe(0);
    expect(r.up).toEqual(l.up);
    expect(r.down).toEqual(l.down);
  });
  it("moves Up costs up and Down costs down by the change in fair when spot rises", () => {
    const l = ladder();
    const up = (OPEN * 10_005n) / 10_000n;
    const r = repriceLadder(l, up, NOW);
    expect(r.shiftTicks).toBeGreaterThan(0);
    expect(r.fairTicks).toBe(fairNow(l, up, NOW));
    expect(r.up[0]![0]).toBe(l.up[0]![0] + r.shiftTicks);
    expect(r.down[0]![0]).toBe(l.down[0]![0] - r.shiftTicks);
  });
  it("walks a ladder without a model as published", () => {
    const l = ladder({ sigmaBps: null });
    expect(repriceLadder(l, OPEN * 2n, NOW).shiftTicks).toBe(0);
  });
});

describe("liveExit / livePnl", () => {
  it("equals the exit issuer's own walk when nothing moved", () => {
    const l = ladder();
    const contracts = 150n * 1000n * CU;
    const p = livePnl({ ladder: l, spotE8: OPEN, nowSec: NOW, upContractsRaw: contracts, downContractsRaw: 0n, costBasisBase: 150n * 530n * CU });
    const firm = walkExit(bidLevels(l, "up"), 150n, CU)!;
    expect(p.exitBase).toBe(firm.proceedsBase);
    expect(p.upPriceTicks).toBe(firm.priceTicks);
    expect(p.pnlBase).toBe(firm.proceedsBase - 150n * 530n * CU);
  });
  it("Up gains when spot rises, Down loses", () => {
    const l = ladder();
    const contracts = 100n * 1000n * CU;
    const flat = livePnl({ ladder: l, spotE8: OPEN, nowSec: NOW, upContractsRaw: contracts, downContractsRaw: 0n, costBasisBase: 0n });
    const rally = livePnl({ ladder: l, spotE8: (OPEN * 10_010n) / 10_000n, nowSec: NOW, upContractsRaw: contracts, downContractsRaw: 0n, costBasisBase: 0n });
    const downFlat = livePnl({ ladder: l, spotE8: OPEN, nowSec: NOW, upContractsRaw: 0n, downContractsRaw: contracts, costBasisBase: 0n });
    const downRally = livePnl({ ladder: l, spotE8: (OPEN * 10_010n) / 10_000n, nowSec: NOW, upContractsRaw: 0n, downContractsRaw: contracts, costBasisBase: 0n });
    expect(rally.exitBase).toBeGreaterThan(flat.exitBase);
    expect(downRally.exitBase).toBeLessThan(downFlat.exitBase);
  });
  it("is locked past the quoting end or on a closed ladder", () => {
    const contracts = 10n * 1000n * CU;
    expect(livePnl({ ladder: ladder(), spotE8: OPEN, nowSec: NOW + 30, upContractsRaw: contracts, downContractsRaw: 0n, costBasisBase: 5n }).locked).toBe(true);
    expect(livePnl({ ladder: ladder({ state: "closed", up: [], down: [] }), spotE8: OPEN, nowSec: NOW, upContractsRaw: contracts, downContractsRaw: 0n, costBasisBase: 5n })).toMatchObject({ locked: true, pnlBase: 0n });
  });
  it("counts only the fillable part's cost on a thin ladder", () => {
    const l = ladder({ down: [[480, "10"]] });
    const p = livePnl({ ladder: l, spotE8: OPEN, nowSec: NOW, upContractsRaw: 40n * 1000n * CU, downContractsRaw: 0n, costBasisBase: 40_000n });
    expect(p.fillableLots).toBe(10n);
    expect(p.pnlBase).toBe(p.exitBase - 10_000n);
  });
  it("lotsOf inverts contractsOf", () => {
    expect(lotsOf(7n * 1000n * CU, CU)).toBe(7n);
    expect(liveExit({ up: [], down: [] }, { upLots: 0n, downLots: 0n }, CU, true)).toMatchObject({ exitBase: 0n, locked: false });
  });
});
