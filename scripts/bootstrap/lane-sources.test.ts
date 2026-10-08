import { describe, expect, it } from "vitest";
import { attestedPrintSource, parsePrintSource, primarySourceAt } from "@owarine/core/market";
import type { TickerSymbol, XStockSymbol } from "@owarine/core/market";
import { laneVersionsOf } from "../../services/ops/src/prices/lane-versions";
import { lanesFor } from "./venue";

/**
 * C6f: the source a lane settles on is one table, read by the bootstrap (each Series' `printSource` texts) and by
 * halt-watch (`primarySourceAt`), so a lane can never be halted on a source it does not settle on.
 */
const FAMILIES = new Set(["crypto", "regular", "gap", "token", "preipo", "basket", "valuation"]);
const NOW_SEC = Date.parse("2026-09-30T15:00:00Z") / 1000;
const lanes = lanesFor(FAMILIES, NOW_SEC);

describe("bootstrap and halt-watch read the same lane sources", () => {
  const covered = lanes.filter((lane) => laneVersionsOf(lane.symbol as TickerSymbol | XStockSymbol).length > 0);

  it("registers every equity, xStock, pre-IPO and basket lane with exactly the printSource texts the halt table names", () => {
    expect(covered.length).toBeGreaterThan(50);
    for (const lane of covered) {
      const table = laneVersionsOf(lane.symbol as TickerSymbol | XStockSymbol).map((v) => attestedPrintSource(v.primary, v.feed));
      expect(lane.versions.map((v) => v.printSource), lane.seriesKey).toEqual(table);
    }
  });

  it("agrees, at any instant, on the source the lane's newest covering version names", () => {
    for (const lane of covered) {
      const table = laneVersionsOf(lane.symbol as TickerSymbol | XStockSymbol);
      for (const sec of [NOW_SEC, NOW_SEC - 20 * 86_400, NOW_SEC - 3 * 86_400]) {
        const registered = [...lane.versions].reverse().find((v) => v.effectiveFromSec <= sec && (v.validUntilSec === null || sec <= v.validUntilSec));
        expect(primarySourceAt(table, sec), `${lane.seriesKey} @${sec}`).toBe(registered ? parsePrintSource(registered.printSource)?.source : null);
      }
    }
  });

  it("leaves crypto (exchanges) and the valuation lanes out of the halt table", () => {
    const uncovered = lanes.filter((lane) => !covered.includes(lane)).map((lane) => lane.seriesKey.replace(/-\d+m(_\d+)?$/, ""));
    expect(new Set(uncovered)).toEqual(new Set(["BTC", "ETH", "SOL", "OPENAIV", "ANTHROPICV"]));
  });
});

describe("Canton Coin lanes (revamp 2b)", () => {
  const cc = lanesFor(new Set(["cc"]), NOW_SEC);

  it("lists CC on every crypto cadence and stagger, settled on RedStone's CC feed with the crypto lanes' 60 s admission", () => {
    expect(cc.map((l) => l.seriesKey)).toEqual(["CC-2m", "CC-2m_1", "CC-5m", "CC-5m_3", "CC-15m", "CC-60m", "CC-240m", "CC-1440m"]);
    for (const lane of cc) {
      expect(lane.symbol).toBe("CC");
      expect(lane.versions).toHaveLength(1);
      expect(lane.versions[0]).toMatchObject({ printSource: "attested:redstone:CC", minDelaySec: 5, barLenSec: 1, openAdmissionSec: 60, closeAdmissionSec: 60, validUntilSec: null });
    }
  });

  it("is its own family: the crypto family stays BTC, ETH and SOL on the exchange candles", () => {
    expect(lanesFor(new Set(["crypto"]), NOW_SEC).every((l) => l.symbol !== "CC" && parsePrintSource(l.versions[0]!.printSource)?.source === "exchanges")).toBe(true);
  });
});

describe("Solana lanes", () => {
  it("creates all eight SOL cadence and stagger Series with exchange settlement", () => {
    const sol = lanesFor(new Set(["crypto"]), NOW_SEC).filter((l) => l.symbol === "SOL");
    expect(sol.map((l) => l.seriesKey)).toEqual(["SOL-2m", "SOL-2m_1", "SOL-5m", "SOL-5m_3", "SOL-15m", "SOL-60m", "SOL-240m", "SOL-1440m"]);
    for (const lane of sol) {
      expect(lane.versions[0]).toMatchObject({ printSource: "attested:coinbase,kraken,bitstamp 1m candle close", minDelaySec: 5, barLenSec: 60, openAdmissionSec: 60, closeAdmissionSec: 60 });
    }
  });
});
