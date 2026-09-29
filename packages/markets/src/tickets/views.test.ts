import { describe, expect, it } from "vitest";
import type { Address, MarketId } from "@agari/core/types";
import { ticketIdOf } from "./client";
import { parlayTicketOf, rangeRoundOf, sharesOf } from "./views";

const owner = "11111111111111111111111111111111" as Address;
const m = "So11111111111111111111111111111111111111112" as MarketId;
const cid = `00${"ab".repeat(34)}`;
const round = { cid, marketId: m, kind: "range" as const, side: "inside" as const, lowE8: 100n, highE8: 200n, stakeBase: 5n, maxPayoutBase: 20n, expirySec: 10, refundAfterSec: 20, openingPrint: 150n };

describe("ticket views", () => {
  it("gives a ticket a stable numeric id from its contract id", () => {
    expect(ticketIdOf(cid)).toBe(BigInt(`0x${"ab".repeat(7).slice(0, 13)}`));
    expect(rangeRoundOf({ ...round, resolution: null }, owner).roundId).toBe(ticketIdOf(cid));
  });
  it("reads a round's state from its Window's resolution", () => {
    expect(rangeRoundOf({ ...round, resolution: null }, owner).status).toBe("live");
    expect(rangeRoundOf({ ...round, resolution: { closeE8: 150n, void: false } }, owner).status).toBe("won");
    expect(rangeRoundOf({ ...round, resolution: { closeE8: 250n, void: false } }, owner).status).toBe("lost");
    expect(rangeRoundOf({ ...round, side: "outside", resolution: { closeE8: 250n, void: false } }, owner).status).toBe("won");
    expect(rangeRoundOf({ ...round, resolution: { closeE8: null, void: true } }, owner).status).toBe("void");
    expect(rangeRoundOf({ ...round, resolution: null }, owner).houseLockedBase).toBe(15n);
  });
  it("reads a parlay's state from its legs", () => {
    const legs = (a: "pending" | "won" | "lost" | "void", b: "pending" | "won" | "lost" | "void") => [
      { marketId: m, side: "up" as const, expirySec: 10, won: a === "won", resolved: a },
      { marketId: m, side: "down" as const, expirySec: 20, won: b === "won", resolved: b },
    ];
    const t = (a: Parameters<typeof legs>[0], b: Parameters<typeof legs>[1]) => parlayTicketOf({ cid, stakeBase: 5n, maxPayoutBase: 30n, voidAfterSec: 99, legs: legs(a, b) }, owner);
    expect(t("pending", "pending")).toMatchObject({ status: "live", wonCount: 0, lastExpirySec: 20 });
    expect(t("won", "pending")).toMatchObject({ status: "live", wonCount: 1 });
    expect(t("won", "lost").status).toBe("lost");
    expect(t("void", "pending").status).toBe("void");
  });
  it("claims no yield the ledger cannot show", () => {
    expect(sharesOf({ rounds: [], parlays: [], positions: [], shares: [{ reserveId: "range", shares: 10n, worthBase: 12n }] }, "range")).toEqual({ shares: 10n, worthBase: 12n, suppliedBase: 12n, withdrawnBase: 0n });
    expect(sharesOf({ rounds: [], parlays: [], positions: [], shares: [] }, "boost").shares).toBe(0n);
  });
});
