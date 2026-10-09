import type { EventMarket } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { defaultInterval, pickWindow } from "./useTerminalWindow";

const w = (id: string, start: number, len = 120): EventMarket => ({ marketId: id, kind: "price", voided: false, intervalSec: len, tradingStartSec: start, lockAtSec: start + len - 20, expirySec: start + len }) as unknown as EventMarket;

describe("pickWindow on a staggered lane", () => {
  const older = w("BTC-2m:10", 1_000);
  const newer = w("BTC-2m_1:10", 1_060);
  it("moves to the newer Window once it is quoted", () => {
    expect(pickWindow([older, newer], 1_080, (id) => id === older.marketId || id === newer.marketId)?.marketId).toBe(newer.marketId);
  });
  it("stays on the quoted older Window while the newer one is still pricing", () => {
    expect(pickWindow([older, newer], 1_065, (id) => id === older.marketId)?.marketId).toBe(older.marketId);
  });
  it("with nothing quoted, the trading Window that closes first", () => {
    expect(pickWindow([older, newer], 1_065)?.marketId).toBe(older.marketId);
  });
  it("leaves an older quoted round once its real entry cutoff has passed", () => {
    expect(pickWindow([older, newer], 1_075, (id) => id === older.marketId)?.marketId).toBe(newer.marketId);
  });
  it("keeps the closing round visible instead of claiming the future round is opening", () => {
    const future = w("BTC-2m:11", 1_120);
    expect(pickWindow([older, future], 1_105)?.marketId).toBe(older.marketId);
    expect(pickWindow([older, future], 1_120)?.marketId).toBe(future.marketId);
  });
});

describe("pickWindow with a Window it can't draw", () => {
  const stock = w("TSLA-15m:126", 1_000, 900);
  const token = w("TSLAx-15m:126", 1_000, 900);
  it("prefers the quoted Window with a live spot", () => {
    expect(pickWindow([stock, token], 1_100, () => true, (id) => id === stock.marketId)?.marketId).toBe(stock.marketId);
    expect(pickWindow([token, stock], 1_100, () => true, (id) => id === stock.marketId)?.marketId).toBe(stock.marketId);
  });
});

describe("defaultInterval", () => {
  const short = w("ETH-2m:12", 1_000);
  const long = w("ETH-5m:12", 950, 300);
  const lanes = [{ intervalSec: 120, label: "2m" }, { intervalSec: 300, label: "5m" }];

  it("shows a quoted 5m round while the new 2m round is still pricing", () => {
    expect(defaultInterval([short, long], lanes, 1_020, (id) => id === long.marketId)).toBe(300);
  });

  it("returns to the shorter cadence once its quote is live", () => {
    expect(defaultInterval([short, long], lanes, 1_020, () => true)).toBe(120);
  });

  it("keeps the shortest lane when none is quoted", () => {
    expect(defaultInterval([short, long], lanes, 1_020, () => false)).toBe(120);
  });
});
