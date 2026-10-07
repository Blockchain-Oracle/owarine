import type { EventMarket, LaneSet } from "@owarine/core/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW_SEC = 1_791_250_000;
const window = (marketId: string) =>
  ({ marketId, asset: "BTC", lane: "token", intervalSec: 3_600, tradingStartSec: NOW_SEC - 600, lockAtSec: NOW_SEC + 3_000, expirySec: NOW_SEC + 3_000, status: "Open", voided: false }) as unknown as EventMarket;
const lanes = { lanes: [{ markets: [window("BTC-1m:7"), window("ETH-1m:7")] }] } as unknown as LaneSet;

const listPublishedFills = vi.fn();
const listWalletFills = vi.fn();
vi.mock("@owarine/markets", () => ({
  marketsProvider: { listLiveLanes: async () => ({ ok: true, value: lanes, stale: false }) },
  listPublishedFills: (...a: unknown[]) => listPublishedFills(...a),
  listWalletFills: (...a: unknown[]) => listWalletFills(...a),
}));

const { scanVenueMirror } = await import("./mirror-scan");
const spec = { preset: "mirror" as const, trader: "2jhdTrader1111111111111111111111111111111" as never, withinSec: 300 };

describe("A-3b on Canton: a copier follows only what the trader published (C8d)", () => {
  beforeEach(() => {
    listPublishedFills.mockReset();
    listWalletFills.mockReset();
  });

  it("reads published fills, never the trader's lease-scoped wallet rows, and copies the side it is net on", async () => {
    listPublishedFills.mockResolvedValue({ ok: true, stale: false, value: [{ marketId: "BTC-1m:7", side: "BUY_YES", quantityRaw: 5_000_000n, yesPriceRaw: 600_000n, atMs: NOW_SEC * 1000 - 5_000, txHash: "u1" }] });
    const scan = await scanVenueMirror("venue" as never, spec, NOW_SEC * 1000);
    expect(listWalletFills).not.toHaveBeenCalled();
    expect(listPublishedFills).toHaveBeenCalledWith(spec.trader, { sinceSec: NOW_SEC - 300, limit: 50 });
    expect(scan.candidates.map((c) => [c.market.marketId, c.decision.side])).toEqual([["BTC-1m:7", "up"]]);
    expect(scan.why).toBe("scanned 2 markets, this trader is net on 1");
  });

  it("says the published calls are unreadable rather than sitting out silently", async () => {
    listPublishedFills.mockResolvedValue({ ok: false, error: { technical: "indexer 503" } });
    const scan = await scanVenueMirror("venue" as never, spec, NOW_SEC * 1000);
    expect(scan.candidates).toEqual([]);
    expect(scan.why).toBe("this trader's published calls are unreadable: indexer 503");
  });
});
