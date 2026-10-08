import type { EventMarket } from "@owarine/core/types";
import { describe, expect, it } from "vitest";
import { legOf, legOpen, rolledLegs, toggledLegs, type SlipLeg } from "./slip";

const NOW = 10_000;
const w = (id: string, asset: string, start: number, len = 120, intervalSec = 120): EventMarket =>
  ({ marketId: id, asset, intervalSec, kind: "price", voided: false, tradingStartSec: start, lockAtSec: start + len - 10, expirySec: start + len, poolAddress: id, decimals: 6 }) as unknown as EventMarket;

describe("toggling a leg", () => {
  const btc = legOf(w("btc", "BTC", NOW - 30), "up");
  const eth = legOf(w("eth", "ETH", NOW - 30), "down");
  it("adds, flips the side, then takes it off on the same side again", () => {
    const added = toggledLegs([], btc);
    expect(added.result).toBe("added");
    const flipped = toggledLegs(added.legs, { ...btc, side: "down" });
    expect(flipped).toMatchObject({ result: "flipped", legs: [{ marketId: "btc", side: "down" }] });
    expect(toggledLegs(flipped.legs, { ...btc, side: "down" })).toMatchObject({ result: "removed", legs: [] });
  });
  it("holds at most three legs", () => {
    const cc = legOf(w("cc", "CC", NOW - 30), "up");
    const full = [btc, eth, cc];
    expect(toggledLegs(full, legOf(w("sol", "SOL", NOW - 30), "up"), 3)).toMatchObject({ result: "full", legs: full });
  });
});

describe("rolling a closing leg", () => {
  const quoting = (ids: string[]) => (id: string) => ids.includes(id);
  it("leaves a leg alone while it can still join a ticket", () => {
    const leg = legOf(w("a", "BTC", NOW - 30), "up");
    expect(legOpen(leg, NOW)).toBe(true);
    const r = rolledLegs([leg], [], NOW, quoting([]));
    expect(r.moved).toEqual([]);
  });

  it("moves to the quoted Window with the most time left on the same lane, keeping the side", () => {
    const old = legOf(w("old", "BTC", NOW - 100), "down"); // 20 s left
    const markets = [w("old", "BTC", NOW - 100), w("mid", "BTC", NOW - 60), w("new", "BTC", NOW - 5), w("eth", "ETH", NOW - 5), w("5m", "BTC", NOW - 5, 300, 300)];
    const r = rolledLegs([old], markets, NOW, quoting(["mid", "new"]));
    expect(r.legs[0]).toMatchObject({ marketId: "new", side: "down", intervalSec: 120 });
    expect(r.moved).toHaveLength(1);
  });

  it("prefers a quoted Window over a newer one still waiting for its price", () => {
    const old = legOf(w("old", "BTC", NOW - 100), "up");
    const r = rolledLegs([old], [w("mid", "BTC", NOW - 60), w("new", "BTC", NOW - 5)], NOW, quoting(["mid"]));
    expect(r.legs[0]?.marketId).toBe("mid");
  });

  it("moves a leg whose Window has passed its quote cut-off, even with time left to its close", () => {
    const leg = legOf(w("old", "BTC", NOW - 70), "up"); // 50 s left, no longer quoted
    expect(legOpen(leg, NOW)).toBe(true);
    const r = rolledLegs([leg], [w("old", "BTC", NOW - 70), w("new", "BTC", NOW - 10)], NOW, quoting(["new"]), (id) => id === "old");
    expect(r.legs[0]?.marketId).toBe("new");
  });

  it("never takes a Window another leg holds, and stays put with no successor", () => {
    const held: SlipLeg = legOf(w("new", "BTC", NOW - 5), "up");
    const old = legOf(w("old", "BTC", NOW - 100), "up");
    const r = rolledLegs([held, old], [w("new", "BTC", NOW - 5)], NOW, quoting(["new"]));
    expect(r.moved).toEqual([]);
    expect(r.legs[1]?.marketId).toBe("old");
  });
});
