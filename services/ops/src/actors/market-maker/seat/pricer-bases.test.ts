import type { TermsC } from "@agari/markets/ops/canton";
import { describe, expect, it } from "vitest";
import type { SpotFeed } from "../../../prices/spot";
import { readSeatMakerEnv } from "./env";
import { GAP_BLIND_FAIR_TICKS, GAP_BLIND_HALF_SPREAD_TICKS } from "./gap-fair";
import { eventPrice, gapPrice } from "./pricer";

const utc = (iso: string) => Date.parse(iso) / 1000;
const maker = readSeatMakerEnv({});
/** The 09-18 Gap as `Series_OpenWindowSpan` lists it. */
const gap: TermsC = {
  venue: "v", resolver: "r", seriesKey: "TSLA-gap", marketId: "TSLA-gap:0", index: 0, symbol: "TSLA", cashUnit: 1000n,
  tradingStartSec: utc("2026-09-18T20:00:00Z"), lockAtSec: utc("2026-09-21T00:00:00Z"), expirySec: utc("2026-09-21T13:30:00Z"),
  openDeadlineSec: utc("2026-09-21T00:00:00Z"), closeDeadlineSec: utc("2026-09-21T13:45:00Z"), refundAfterSec: utc("2026-09-21T13:50:00Z"),
  policyVersion: 1, printSource: "attested:redstone:TSLA", minDelaySec: 5, barLenSec: 1, tieUp: true, oracles: [], quorum: 2, maxDeviationBps: 100,
};
const OPEN = 400_00000000n;
const spotOf = (prices: Record<string, bigint>): SpotFeed => ({ latest: (s: string) => (prices[s] ? { priceE8: prices[s]!, atMs: Date.now() } : null) }) as unknown as SpotFeed;

describe("pricer bases (C6d)", () => {
  it("prices a Gap on the TSLAx weekend spot against Friday's print, and stops 60 s before the Sunday lock", () => {
    const sat = utc("2026-09-19T12:00:00Z");
    const up = gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: sat, spot: spotOf({ TSLAx: 420_00000000n }), halts: {}, maker });
    expect(up).toMatchObject({ basis: "gap", halfSpreadTicks: maker.halfSpreadTicks, untilSec: gap.lockAtSec - 60, capBase: maker.gapMaxCash, spotE8: 420_00000000n });
    expect("fairTicks" in up && up.fairTicks > 500).toBe(true);
    const down = gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: sat, spot: spotOf({ TSLAx: 380_00000000n }), halts: {}, maker });
    expect("fairTicks" in down && down.fairTicks < 500).toBe(true);
    expect(gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: gap.lockAtSec - 30, spot: null, halts: {}, maker })).toEqual({ skip: "60 s before the Sunday lock" });
    expect(gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: gap.tradingStartSec - 1, spot: null, halts: {}, maker })).toEqual({ skip: "Gap not trading yet" });
  });

  it("goes blind and wide without a weekend reference, or with the xStock halted", () => {
    const sat = utc("2026-09-19T12:00:00Z");
    const blind = gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: sat, spot: null, halts: {}, maker });
    expect(blind).toMatchObject({ fairTicks: GAP_BLIND_FAIR_TICKS, halfSpreadTicks: Math.max(GAP_BLIND_HALF_SPREAD_TICKS, maker.halfSpreadTicks), spotE8: OPEN });
    const halted = gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: sat, spot: spotOf({ TSLAx: 420_00000000n }), halts: { TSLAx: { reason: "issuer pause" } } as never, maker });
    expect(halted).toMatchObject({ fairTicks: GAP_BLIND_FAIR_TICKS });
    expect(gapPrice({ t: gap, ticker: "TSLA", openE8: OPEN, nowSec: sat, spot: null, halts: { TSLA: { reason: "LULD" } } as never, maker })).toEqual({ skip: "halted (LULD)" });
  });

  it("prices a committee event at 500 ± 150 until it stops taking quotes", () => {
    const ev: TermsC = { ...gap, seriesKey: "EVT-DEMO-1", marketId: "EVT-DEMO-1:0", tradingStartSec: 1_000, lockAtSec: 1_500, expirySec: 1_600 };
    expect(eventPrice(ev, 7n)).toMatchObject({ fairTicks: 500, halfSpreadTicks: 150, untilSec: 1_500, capBase: 7n, spotE8: 0n, basis: "event" });
  });
});
