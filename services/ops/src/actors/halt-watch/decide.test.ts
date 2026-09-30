import { describe, expect, it } from "vitest";
import { ALPACA_STALE_SEC, HALT_ASSETS, PRESTOCKS_STALE_SEC, primarySourceAt, type HaltAsset } from "@agari/core/market";
import { emptyHaltState, observeHalts, stepHalts, type Observations } from "./decide";
import { applyFixture, loadHaltFixture } from "./fixture";
import { loadSourceVersions } from "./signals";

/** Wednesday 2026-09-30 11:00 ET: regular hours, after the Pyth trial (09-25) and after C6e's Alpaca and Jupiter versions (09-29). */
const NOW = Date.parse("2026-09-30T15:00:00Z") / 1000;

/** Each halt asset's primary at `NOW`, from the same table the bootstrap registers the Series from, exactly as `index.ts` builds it. */
const versions = loadSourceVersions();
const primaryAt = (nowSec: number): Observations["primary"] => Object.fromEntries(HALT_ASSETS.map((asset) => [asset, primarySourceAt(versions[asset] ?? [], nowSec)]));

const live = (over: Partial<Observations> = {}): Observations => ({
  nowSec: NOW,
  inRegularHours: true,
  watchingPrestocks: true,
  primary: primaryAt(NOW),
  // A wide Pyth tick for every ticker Pyth ever carried here: whatever a lane settles on, this must never halt it.
  pyth: { TSLA: { price: 36_547_600n, conf: 3_000_000n, publishTimeSec: NOW - 600 }, QQQ: { price: 71_490_000n, conf: 3_000_000n, publishTimeSec: NOW - 600 }, VOO: { price: 70_249_748n, conf: 3_000_000n, publishTimeSec: NOW - 600 } },
  redstoneNewestSec: { TSLA: NOW - 5, NVDA: NOW - 5, AAPL: NOW - 5, MSFT: NOW - 5, META: NOW - 5, AMZN: NOW - 5, GOOGL: NOW - 5 },
  alpacaNewestSec: { QQQ: NOW - 10, VOO: NOW - 30 },
  prestocksNewestSec: { OPENAI: NOW - 8, ANTHROPIC: NOW - 8, SPACEX: NOW - 8, NEURALINK: NOW - 8, ANDURIL: NOW - 8, KALSHI: NOW - 8, POLYMARKET: NOW - 8, FIGUREAI: NOW - 8, AILABS: NOW - 8, FRONTIER: NOW - 8, PREDMKTS: NOW - 8, DEFSPACE: NOW - 8, PREALL: NOW - 8 },
  issuer: { TSLAx: false, NVDAx: false, SPYx: false, QQQx: false },
  quoteFailures: {},
  ...over,
});
const halted = (board: Map<string, string | null>) => Object.fromEntries([...board].filter(([, r]) => r !== null));
/** Two passes in a row: a change takes two observations (the issuer flag one). */
const settle = (o: Observations, inHours = true) => {
  const state = emptyHaltState();
  stepHalts(state, observeHalts(o), inHours);
  return halted(stepHalts(state, observeHalts(o), inHours));
};

describe("which source each lane is judged on (the table the bootstrap registers the Series from)", () => {
  const primary = primaryAt(NOW);

  it("reads RedStone for the seven single names, Alpaca for QQQ and VOO, Jupiter for the xStocks, PreStocks for the pre-IPO names and baskets", () => {
    expect(primary).toMatchObject({
      TSLA: "redstone", NVDA: "redstone", AAPL: "redstone", MSFT: "redstone", META: "redstone", AMZN: "redstone", GOOGL: "redstone",
      QQQ: "alpaca", VOO: "alpaca",
      TSLAx: "jupiter", NVDAx: "jupiter", SPYx: "jupiter", QQQx: "jupiter",
      OPENAI: "prestocks", SPACEX: "prestocks", AILABS: "basket", PREALL: "basket",
    });
    // No lane's primary is Pyth today, so no lane can halt on a Pyth tick.
    expect(Object.values(primary)).not.toContain("pyth");
  });

  it("covers no crypto and no valuation lane, and gives SPY, which has no signed source, none to judge", () => {
    for (const asset of ["BTC", "ETH", "OPENAIV", "ANTHROPICV"]) expect(HALT_ASSETS).not.toContain(asset as HaltAsset);
    expect(primary.SPY).toBeNull();
    expect(settle(live({ redstoneNewestSec: {}, alpacaNewestSec: {} }))).not.toHaveProperty("SPY");
  });
});

describe("halt-watch step", () => {
  it("halts nothing on healthy sources, whatever the Pyth ticks say", () => {
    expect(settle(live())).toEqual({});
  });

  it("halts a QQQ lane on a stale Alpaca trade and never on a Pyth tick", () => {
    const state = emptyHaltState();
    const stale = live({ alpacaNewestSec: { QQQ: NOW - (ALPACA_STALE_SEC + 1), VOO: NOW - 30 } });
    expect(halted(stepHalts(state, observeHalts(stale), true))).toEqual({});
    expect(halted(stepHalts(state, observeHalts(stale), true))).toEqual({ QQQ: "alpaca-stale" });
    // The trade at exactly the threshold is still live, and a Pyth tick that is wide and old (the trial's feed) changes nothing either way.
    expect(settle(live({ alpacaNewestSec: { QQQ: NOW - ALPACA_STALE_SEC, VOO: NOW - 30 } }))).toEqual({});
    expect(settle(live({ alpacaNewestSec: { QQQ: NOW - 1, VOO: NOW - 1 }, pyth: { QQQ: { price: 71_490_000n, conf: 71_490_000n, publishTimeSec: NOW - 3_600 } } }))).toEqual({});
    // No trade seen at all is stale too (the source is unreadable), like a RedStone feed never read.
    expect(settle(live({ alpacaNewestSec: { VOO: NOW - 30 } }))).toEqual({ QQQ: "alpaca-stale" });
  });

  it("halts a TSLA lane on a stale RedStone package, and never on Pyth", () => {
    const state = emptyHaltState();
    const stale = live({ redstoneNewestSec: { ...live().redstoneNewestSec, TSLA: NOW - 61 } });
    stepHalts(state, observeHalts(stale), true);
    expect(halted(stepHalts(state, observeHalts(stale), true))).toEqual({ TSLA: "redstone-stale" });
    // The fresh package clears it after two passes, and TSLA's wide, 10-minute-old Pyth tick never mattered.
    const healed = observeHalts(live());
    stepHalts(state, healed, true);
    expect(halted(stepHalts(state, healed, true))).toEqual({});
  });

  it("judges a lane on its own source: a stale RedStone package does not halt QQQ, a stale Alpaca trade does not halt NVDA", () => {
    const o = live({ redstoneNewestSec: { ...live().redstoneNewestSec, QQQ: NOW - 3_600 }, alpacaNewestSec: { ...live().alpacaNewestSec, NVDA: NOW - 3_600 } });
    expect(settle(o)).toEqual({});
  });

  it("still halts a lane whose primary is Pyth on the tick, as the reference did (a wide tick says Trading halted, a stale one does not)", () => {
    const pyth = { ...live().primary, TSLA: "pyth" as const };
    const wide = live({ primary: pyth, pyth: { TSLA: { price: 36_547_600n, conf: 182_739n, publishTimeSec: NOW } } });
    expect(settle(wide)).toEqual({ TSLA: "pyth-wide" });
    expect(settle({ ...wide, pyth: { TSLA: { price: 36_547_600n, conf: 6_068n, publishTimeSec: NOW - 16 } } })).toEqual({ TSLA: "pyth-stale" });
    expect(settle({ ...wide, pyth: { TSLA: { price: 36_547_600n, conf: 6_068n, publishTimeSec: NOW - 1 } } })).toEqual({});
  });

  it("ignores a lane with no source at all (paused, never halted)", () => {
    const none = { ...live().primary, QQQ: null, TSLA: null };
    const { TSLA: _tsla, ...redstone } = live().redstoneNewestSec;
    expect(settle(live({ primary: none, alpacaNewestSec: { VOO: NOW - 30 }, redstoneNewestSec: redstone }))).toEqual({});
  });

  it("clears every stock halt at the close at once, and keeps the 24/7 halts overnight", () => {
    const state = emptyHaltState();
    const bad = live({ issuer: { NVDAx: true }, alpacaNewestSec: { QQQ: NOW - 500, VOO: NOW - 30 }, prestocksNewestSec: { ...live().prestocksNewestSec, OPENAI: NOW - 500 } });
    stepHalts(state, observeHalts(bad), true);
    expect(halted(stepHalts(state, observeHalts(bad), true))).toEqual({ NVDAx: "issuer-halt", QQQ: "alpaca-stale", OPENAI: "prestocks-stale" });
    const closed = { ...bad, inRegularHours: false };
    expect(halted(stepHalts(state, observeHalts(closed), false))).toEqual({ NVDAx: "issuer-halt", OPENAI: "prestocks-stale" });
  });

  it("confirms the issuer's flag at once and keeps it after the bell", () => {
    const state = emptyHaltState();
    const flagged = live({ issuer: { NVDAx: true } });
    expect(halted(stepHalts(state, observeHalts(flagged), true))).toEqual({ NVDAx: "issuer-halt" });
    const closed = { ...flagged, inRegularHours: false };
    expect(halted(stepHalts(state, observeHalts(closed), false))).toEqual({ NVDAx: "issuer-halt" });
  });
});

describe("the 24/7 lanes", () => {
  it("halts an xStock on three failed Jupiter quotes while its lane settles on Jupiter, and not on two", () => {
    expect(settle(live({ quoteFailures: { TSLAx: 2 } }))).toEqual({});
    expect(settle(live({ quoteFailures: { TSLAx: 3 } }))).toEqual({ TSLAx: "quote-unavailable" });
  });

  it("counts Jupiter's failures only for a lane that settles on Jupiter", () => {
    const later = { ...live().primary, TSLAx: "switchboard" as const };
    expect(settle(live({ primary: later, quoteFailures: { TSLAx: 9 } }))).toEqual({});
    // The issuer's flag halts the xStock whatever its source.
    expect(settle(live({ primary: later, issuer: { TSLAx: true } }))).toEqual({ TSLAx: "issuer-halt" });
  });

  it("halts a pre-IPO name and a basket on a stale PreStocks read, at any hour", () => {
    const stale = live({ prestocksNewestSec: { ...live().prestocksNewestSec, OPENAI: NOW - (PRESTOCKS_STALE_SEC + 1), AILABS: NOW - 3_600 } });
    expect(settle(stale)).toEqual({ OPENAI: "prestocks-stale", AILABS: "prestocks-stale" });
    // Overnight: stock lanes are idle, the PreStocks lanes are not.
    expect(settle({ ...stale, inRegularHours: false }, false)).toEqual({ OPENAI: "prestocks-stale", AILABS: "prestocks-stale" });
    expect(settle(live({ prestocksNewestSec: { ...live().prestocksNewestSec, OPENAI: NOW - PRESTOCKS_STALE_SEC } }))).toEqual({});
  });

  it("does not judge the PreStocks lanes without a PreStocks read in this process, or inside the boot grace", () => {
    expect(settle(live({ watchingPrestocks: false, prestocksNewestSec: {} }))).toEqual({});
  });

  it("never halts crypto: it is not a halt asset", () => {
    expect(Object.keys(observeHalts(live()))).not.toContain("BTC");
  });
});

describe("the injected halted-session fixture (HALT_WATCH_FIXTURE proof)", () => {
  it("halts each lane on the source it settles on, and leaves TSLA, whose wide Pyth tick is not its source, live", () => {
    const fixture = loadHaltFixture(new URL("./fixtures/halted-session.json", import.meta.url).pathname)!;
    const o = live({ inRegularHours: false, watchingPrestocks: false, issuer: {}, quoteFailures: {} });
    applyFixture(o, fixture);
    expect(fixture.session).toBe("regular");
    expect(settle({ ...o, inRegularHours: true })).toEqual({
      NVDA: "redstone-stale", QQQ: "alpaca-stale", OPENAI: "prestocks-stale", NVDAx: "issuer-halt", QQQx: "quote-unavailable",
    });
  });
});
