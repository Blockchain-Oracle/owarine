import { CALENDAR_YEAR_SEC, fairYesTicks } from "@owarine/core/market";
import { parlayParams, priceParlay } from "@owarine/markets/parlay";
import { parseLadder, type Ladder } from "@owarine/markets/runtime";
import { describe, expect, it } from "vitest";
import { estimateParlay, legChance, legLead, markParlay, parlayOutcome, ticketWindowOf } from "./price";

const NOW = 1_791_370_000;
const OPEN = 8_376_100_000_000n;

function ladder(id: string, o: Partial<Record<string, unknown>> = {}): Ladder {
  const fair = fairYesTicks({ spotE8: OPEN, openE8: OPEN, secondsLeft: 100, sigmaBps: 4000, yearSec: CALENDAR_YEAR_SEC, minTick: 10 });
  return parseLadder({
    marketId: id, damlMarketId: `${id}:1`, seriesId: "s", termsCid: `terms-${id}`, seriesKey: "k", symbol: "BTC", index: 1,
    tradingStartSec: NOW - 20, lockAtSec: NOW + 90, expirySec: NOW + 100, quotingUntilSec: NOW + 80, cashUnit: "1000", feeRateBps: 100,
    fairTicks: fair, sigmaBps: 4000, yearSec: CALENDAR_YEAR_SEC, minTick: 10, halfSpreadTicks: 30, openPriceE8: OPEN.toString(), spotE8: OPEN.toString(),
    up: [[fair + 30, "5000"]], down: [[1000 - (fair - 30), "5000"]], asOfMs: NOW * 1000, state: "quoting", ...o,
  })!;
}

const C = 1_000_000n;

describe("estimateParlay", () => {
  it("is the reserve's own price over the published ladders when spot is the one they were priced on", () => {
    const a = ladder("a");
    const b = ladder("b", { expirySec: NOW + 200, lockAtSec: NOW + 190, quotingUntilSec: NOW + 180 });
    const est = estimateParlay([{ ladder: a, side: "up", spotE8: OPEN }, { ladder: b, side: "down", spotE8: OPEN }], 5n * C, NOW);
    const ops = priceParlay([{ window: ticketWindowOf(a, OPEN, NOW), side: "up" }, { window: ticketWindowOf(b, OPEN, NOW), side: "down" }], { kind: "fixStake", stakeBase: 5n * C }, parlayParams(), NOW);
    expect(est.ok && ops.ok).toBe(true);
    if (!est.ok || !ops.ok) return;
    expect(est.quote.maxPayoutBase).toBe(ops.quote.maxPayoutBase);
    expect(est.quote.stakeBase).toBeLessThanOrEqual(5n * C);
    // Two near-even legs with the reserve's margin pay about 3×.
    expect(est.quote.multiplierMilli).toBeGreaterThan(2_500);
    expect(est.quote.multiplierMilli).toBeLessThan(4_000);
    expect(est.quote.correlated).toBe(false);
  });

  it("re-prices a leg at the live spot: a leg already ahead costs more, so the ticket pays less", () => {
    const a = ladder("a");
    const b = ladder("b", { expirySec: NOW + 200, lockAtSec: NOW + 190, quotingUntilSec: NOW + 180 });
    const flat = estimateParlay([{ ladder: a, side: "up", spotE8: OPEN }, { ladder: b, side: "up", spotE8: OPEN }], 5n * C, NOW);
    const ahead = estimateParlay([{ ladder: a, side: "up", spotE8: (OPEN * 10_010n) / 10_000n }, { ladder: b, side: "up", spotE8: OPEN }], 5n * C, NOW);
    expect(flat.ok && ahead.ok).toBe(true);
    if (flat.ok && ahead.ok) expect(ahead.quote.maxPayoutBase).toBeLessThan(flat.quote.maxPayoutBase);
  });

  it("names the leg that has no live price", () => {
    const est = estimateParlay([{ ladder: ladder("a"), side: "up", spotE8: OPEN }, { ladder: ladder("b", { state: "locked" }), side: "up", spotE8: OPEN }], 5n * C, NOW);
    expect(est).toMatchObject({ ok: false, legIdx: 1 });
  });

  it("asks for a second market, and for a stake", () => {
    expect(estimateParlay([{ ladder: ladder("a"), side: "up", spotE8: OPEN }], 5n * C, NOW)).toMatchObject({ ok: false, why: "Add one more market" });
    expect(estimateParlay([{ ladder: ladder("a"), side: "up", spotE8: OPEN }, { ladder: ladder("b"), side: "up", spotE8: OPEN }], 0n, NOW)).toMatchObject({ ok: false, why: "Enter a stake" });
  });

  it("trims the odds when two legs close at the same instant", () => {
    const est = estimateParlay([{ ladder: ladder("a"), side: "up", spotE8: OPEN }, { ladder: ladder("b"), side: "up", spotE8: OPEN }], 5n * C, NOW);
    expect(est.ok && est.quote.correlated).toBe(true);
  });

  it("refuses a payout over the reserve's cap in words", () => {
    const est = estimateParlay([{ ladder: ladder("a"), side: "up", spotE8: OPEN }, { ladder: ladder("b", { expirySec: NOW + 200 }), side: "up", spotE8: OPEN }], 400n * C, NOW);
    expect(est.ok).toBe(false);
  });
});

describe("marking a ticket", () => {
  it("prices each open leg at its chance now; Up and Down chances sum to one", () => {
    const l = ladder("a");
    const up = legChance(l, "up", OPEN, NOW)!;
    const down = legChance(l, "down", OPEN, NOW)!;
    expect(up + down).toBeCloseTo(1, 9);
    expect(legChance(null, "up", OPEN, NOW)).toBeNull();
  });

  it("is the payout times the open legs' chances; a lost leg is worth nothing; a void returns the stake", () => {
    const stake = 5n * C;
    const pay = 20n * C;
    expect(markParlay([{ status: "won", chance: null, entryChance: 0.5 }, { status: "pending", chance: 0.25, entryChance: 0.5 }], stake, pay)).toBeCloseTo(5_000_000, 0);
    expect(markParlay([{ status: "pending", chance: null, entryChance: 0.5 }, { status: "pending", chance: 0.5, entryChance: 0.5 }], stake, pay)).toBeCloseTo(5_000_000, 0);
    expect(markParlay([{ status: "lost", chance: null, entryChance: 0.5 }, { status: "pending", chance: 0.9, entryChance: 0.5 }], stake, pay)).toBe(0);
    expect(markParlay([{ status: "void", chance: null, entryChance: 0.5 }, { status: "lost", chance: null, entryChance: 0.5 }], stake, pay)).toBe(5_000_000);
  });

  it("decides a ticket on a void, a loss, or every leg won", () => {
    expect(parlayOutcome([{ status: "won" }, { status: "pending" }])).toBe("live");
    expect(parlayOutcome([{ status: "won" }, { status: "won" }])).toBe("won");
    expect(parlayOutcome([{ status: "lost" }, { status: "pending" }])).toBe("lost");
    expect(parlayOutcome([{ status: "void" }, { status: "lost" }])).toBe("void");
  });

  it("calls a leg ahead or behind its line, a tie going Up", () => {
    expect(legLead("up", 100, 100)).toBe("ahead");
    expect(legLead("down", 100, 100)).toBe("behind");
    expect(legLead("down", 99, 100)).toBe("ahead");
    expect(legLead("up", null, 100)).toBeNull();
  });
});
