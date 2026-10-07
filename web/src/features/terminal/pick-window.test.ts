import type { EventMarket } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { pickWindow } from "./useTerminalWindow";

const w = (id: string, start: number, len = 120): EventMarket => ({ marketId: id, kind: "price", voided: false, tradingStartSec: start, lockAtSec: start + len - 20, expirySec: start + len }) as unknown as EventMarket;

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
});
