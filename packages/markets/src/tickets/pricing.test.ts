import { describe, expect, it } from "vitest";
import { leverageParams, parlayParams, rangeParams, riskParamsFor, TICKET_ONE } from "./params";
import { barrierFor, boostMark, boostTermsOk, priceBoost, priceParlay, priceRange, validUntilFor, type TicketWindow } from "./pricing";

const NOW = 1_790_000_000;
const ONE = TICKET_ONE;

function window(o: Partial<TicketWindow> = {}): TicketWindow {
  return {
    termsCid: "00aa", marketId: "m1", damlMarketId: "BTC-1m:7", symbol: "BTC", openPriceE8: 8_434_460_000_000n, fairTicks: 520,
    lockAtSec: NOW + 50, expirySec: NOW + 60, cashUnit: 1000n,
    up: [[530, 200n], [535, 200n], [540, 200n]], down: [[490, 200n], [495, 200n], [500, 200n]],
    ...o,
  };
}

describe("priceRange", () => {
  const w = window();
  const open = w.openPriceE8;
  it("prices a band around the open with core's quoteRange: stake below payout, margin in the reserve's favour", () => {
    const p = priceRange(w, { side: "inside", lowPrint: open - open / 2000n, highPrint: open + open / 2000n }, { kind: "fixPayout", maxPayoutBase: 20n * ONE }, rangeParams(), NOW);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.quote.maxPayoutBase).toBe(20n * ONE);
    expect(p.quote.stakeBase).toBeGreaterThan(0n);
    expect(p.quote.stakeBase).toBeLessThan(20n * ONE);
    // fair = payout × p; the stake carries the margin on top
    expect(p.quote.stakeBase * 1_000_000n).toBeGreaterThan(20n * ONE * p.quote.probRaw);
    expect(p.basis.centerQE6).toBe(520_000);
    expect(p.openingPrint).toBe(open);
  });
  it("refuses a Window too close to its end", () => {
    const p = priceRange(window({ expirySec: NOW + 10 }), { side: "inside", lowPrint: open - 1n, highPrint: open + 1n }, { kind: "fixStake", stakeBase: ONE }, rangeParams(), NOW);
    expect(p).toMatchObject({ ok: false, refusal: { kind: "too-late" } });
  });
  it("refuses a one-sided book as a centre outside the reserve's bounds", () => {
    const p = priceRange(window({ fairTicks: 995 }), { side: "inside", lowPrint: open - open / 100n, highPrint: open + open / 100n }, { kind: "fixStake", stakeBase: ONE }, rangeParams(), NOW);
    expect(p).toMatchObject({ ok: false, refusal: { kind: "centre" } });
  });
});

describe("priceParlay", () => {
  it("prices two Windows with core's quoteParlay off each side's asks", () => {
    const a = window();
    const b = window({ termsCid: "00bb", marketId: "m2", damlMarketId: "ETH-1m:7", symbol: "ETH" });
    const p = priceParlay([{ window: a, side: "up" }, { window: b, side: "down" }], { kind: "fixPayout", maxPayoutBase: 30n * ONE }, parlayParams(), NOW);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.quote.legPricesRaw).toHaveLength(2);
    expect(p.quote.stakeBase).toBeLessThan(30n * ONE);
    // same expiry: the correlation floor applies
    expect(p.quote.correlated).toBe(true);
  });
  it("refuses the same Window twice", () => {
    const a = window();
    expect(priceParlay([{ window: a, side: "up" }, { window: a, side: "down" }], { kind: "fixStake", stakeBase: ONE }, parlayParams(), NOW)).toMatchObject({ ok: false, refusal: { kind: "duplicate-leg" } });
  });
});

describe("priceBoost", () => {
  const w = window();
  it("sizes stake-first at one price and meets every ledger bound (boostTermsOk)", () => {
    for (const lev of [10_000, 15_000, 20_000, 30_000]) {
      for (const stake of [1n * ONE, 7n * ONE, 25n * ONE]) {
        for (const side of ["up", "down"] as const) {
          const p = priceBoost(w, side, stake, lev, leverageParams(), NOW);
          expect(p.ok, `${side} ${lev} ${stake}`).toBe(true);
          if (!p.ok) continue;
          expect(boostTermsOk(p.terms)).toBe(true);
          expect(p.terms.stake).toBeLessThanOrEqual(stake);
          expect(p.terms.stake + p.terms.fronted - p.terms.premium).toBe(p.terms.lots * BigInt(p.terms.priceTicks) * p.terms.cashUnit);
          if (lev === 10_000) expect(p.terms.fronted).toBe(0n);
          else expect(p.terms.knockOutProceeds).toBeGreaterThanOrEqual(p.terms.fronted);
        }
      }
    }
  });
  it("puts an Up barrier below the open and a Down barrier above it", () => {
    const up = priceBoost(w, "up", 10n * ONE, 20_000, leverageParams(), NOW);
    const down = priceBoost(w, "down", 10n * ONE, 20_000, leverageParams(), NOW);
    expect(up.ok && down.ok).toBe(true);
    if (!up.ok || !down.ok) return;
    expect(up.terms.barrierE8).toBeLessThan(w.openPriceE8);
    expect(down.terms.barrierE8).toBeGreaterThan(w.openPriceE8);
  });
  it("refuses a multiple over the reserve's maximum and an empty side", () => {
    expect(priceBoost(w, "up", ONE, 40_000, leverageParams(), NOW)).toMatchObject({ ok: false, refusal: { kind: "bad-leverage" } });
    expect(priceBoost(window({ up: [] }), "up", ONE, 20_000, leverageParams(), NOW)).toMatchObject({ ok: false, refusal: { kind: "thin-book" } });
  });
  it("marks at the venue's fair price and is knockable at or under its pinned line", () => {
    const p = { side: "up" as const, lots: 10n, cashUnit: 1000n, fronted: 4_000_000n, knockOutProceeds: 4_400_000n };
    expect(boostMark(p, 500)).toEqual({ markBase: 5_000_000n, lineBase: 4_400_000n, knockable: false });
    expect(boostMark(p, 400).knockable).toBe(true);
    expect(boostMark({ ...p, side: "down" }, 600).markBase).toBe(4_000_000n);
    expect(boostMark(p, null)).toEqual({ markBase: 0n, lineBase: 4_400_000n, knockable: false });
  });
});

describe("params and quote life", () => {
  it("never holds a quote past the Window's lock", () => {
    expect(validUntilFor({ lockAtSec: NOW + 5 }, NOW)).toBe(NOW + 5);
    expect(validUntilFor({ lockAtSec: NOW + 500 }, NOW)).toBe(NOW + 20);
  });
  it("derives the ledger's caps from the pricer's own", () => {
    expect(riskParamsFor("range").maxPerTicket).toBe(rangeParams().maxPayoutCapBase);
    expect(riskParamsFor("boost").maxLeverageBps).toBe(leverageParams().maxLeverageBps);
    expect(riskParamsFor("parlay").maxPerExpiry).toBe(parlayParams().maxExpiryLockedBase);
  });
  it("puts no barrier on a position with nothing fronted", () => {
    expect(barrierFor(window(), "up", 0n, 10n, NOW)).toBe(0n);
  });
});
