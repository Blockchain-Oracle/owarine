import { describe, expect, it } from "vitest";
import type { Address, MarketId } from "@owarine/core/types";
import type { TicketReceiptView } from "../provider/ticket-wire";
import { ticketIdOf } from "./client";
import { TICKET_ONE } from "./params";
import { endedBoosts, endedParlays, endedRounds, leveragePositionOfReceipt, parlayTicketOfReceipt, rangeRoundOfReceipt } from "./receipt-views";
import { parseBoostPick, parseParlayPick, parseRangePick } from "./receipt-pick";

const owner = "11111111111111111111111111111111" as Address;
const m = "So11111111111111111111111111111111111111112" as MarketId;
const m2 = "So11111111111111111111111111111111111111113" as MarketId;
const cid = `00${"cd".repeat(34)}`;

// Figures from the Daml money gates (Test.Tickets.Receipts, Test.Tickets.ExitReceipts).
const base: TicketReceiptView = {
  cid, product: "range", result: "won", settledAtSec: 1_000, marketId: m, side: "up", resolved: "up", lots: 1n, cashUnit: 1n, backingShare: 400n,
  cost: 400n, payout: 1000n, fee: 0n, stakeBase: 400n, toReserveBase: 0n, pick: "Inside 100..200", expirySec: 900, openingPrint: 150n, closingPrint: 160n, legs: [],
};
const boost = (o: Partial<TicketReceiptView>): TicketReceiptView => ({
  ...base, product: "boost", pick: "Up @20000bps", lots: 4n, cashUnit: 1n, backingShare: 2000n, cost: 1026n, stakeBase: 1026n, ...o,
});

describe("receipt picks", () => {
  it("reads the texts abu-pm-tickets writes", () => {
    expect(parseRangePick("Outside 8430000000000..8440000000000")).toEqual({ side: "outside", lowE8: 8430000000000n, highE8: 8440000000000n });
    expect(parseParlayPick("Up,Down,Up")).toEqual(["up", "down", "up"]);
    expect(parseBoostPick("Down @10000bps")).toEqual({ side: "down", leverageBps: 10_000 });
    expect(parseRangePick("Up @2bps")).toBeNull();
    expect(parseParlayPick("Up,Sideways")).toBeNull();
  });
});

describe("ended rounds", () => {
  it("a won round is paid, never claimable again", () => {
    const r = rangeRoundOfReceipt(base, owner)!;
    expect(r).toMatchObject({ status: "claimed", side: "inside", lowPrint: 100n, highPrint: 200n, stakeBase: 400n, maxPayoutBase: 1000n, houseLockedBase: 600n, settledAtSec: 1_000, closingPrint: 160n });
    expect(r.roundId).toBe(ticketIdOf(cid));
    expect(r.probRaw).toBe((400n * TICKET_ONE) / 1000n);
  });
  it("the escrow is what the receipt paid both sides, lost or void", () => {
    expect(rangeRoundOfReceipt({ ...base, result: "lost", payout: 0n, toReserveBase: 1000n }, owner)).toMatchObject({ status: "lost", maxPayoutBase: 1000n });
    // a stale refund: stake back, the lock back to the reserve, no Window print
    expect(rangeRoundOfReceipt({ ...base, result: "void", resolved: null, payout: 400n, toReserveBase: 600n, closingPrint: null }, owner)).toMatchObject({ status: "void", maxPayoutBase: 1000n, closingPrint: null });
  });
  it("keeps moonshots, and no other product", () => {
    expect(rangeRoundOfReceipt({ ...base, product: "moonshot" }, owner)?.status).toBe("claimed");
    expect(endedRounds([base, boost({}), { ...base, product: "parlay" }], owner)).toHaveLength(1);
  });
});

describe("ended parlays", () => {
  const parlay: TicketReceiptView = {
    ...base, product: "parlay", pick: "Up,Down", cost: 200n, stakeBase: 200n, payout: 1000n, toReserveBase: 0n, marketId: m2, side: "down",
    legs: [
      { marketId: m, side: "up", expirySec: 60, resolved: "won" },
      { marketId: m2, side: "down", expirySec: 120, resolved: "won" },
    ],
  };
  it("a won ticket is paid, both legs won", () => {
    expect(parlayTicketOfReceipt(parlay, owner)).toMatchObject({ status: "claimed", legCount: 2, wonCount: 2, lastExpirySec: 120, maxPayoutBase: 1000n, houseLockedBase: 800n });
  });
  it("a lost or voided ticket keeps its undecided legs pending", () => {
    const lost = parlayTicketOfReceipt({ ...parlay, result: "lost", payout: 0n, toReserveBase: 1000n, legs: [{ ...parlay.legs[0]!, resolved: "lost" }, { ...parlay.legs[1]!, resolved: "pending" }] }, owner)!;
    expect(lost).toMatchObject({ status: "lost", wonCount: 0, maxPayoutBase: 1000n });
    expect(lost.legs.map((l) => [l.status, l.resolvedAtSec])).toEqual([["lost", 1_000], ["pending", null]]);
    expect(parlayTicketOfReceipt({ ...parlay, result: "void", payout: 200n, toReserveBase: 800n }, owner)?.status).toBe("void");
    expect(endedParlays([parlay, base], owner)).toHaveLength(1);
  });
});

describe("ended boosts", () => {
  it("settled: the front repaid, the premium recognised, the rest the owner's", () => {
    const p = leveragePositionOfReceipt(boost({ payout: 4000n - 1025n, fee: 51n, toReserveBase: 1025n + 51n }), owner)!;
    expect(p).toMatchObject({
      status: "settled", side: "up", leverageBps: 20_000, quantityRaw: 4000n, stakeBase: 1026n, frontedBase: 1025n, premiumBase: 51n,
      proceedsBase: 4000n, reclaimedBase: 1025n, returnedBase: 2975n, owedBase: 0n, exitedAtSec: 1_000,
    });
    expect(p.entryPriceRaw).toBe((500n * TICKET_ONE) / 1000n);
  });
  it("lost: nothing to the owner, the front read from the position's terms", () => {
    expect(leveragePositionOfReceipt(boost({ result: "lost", resolved: "down", payout: 0n, fee: 51n, toReserveBase: 51n }), owner)).toMatchObject({
      status: "settled", frontedBase: 1025n, premiumBase: 51n, proceedsBase: 0n, reclaimedBase: 0n, returnedBase: 0n,
    });
  });
  it("void and stale refund: cost and premium back, no fee", () => {
    expect(leveragePositionOfReceipt(boost({ result: "void", resolved: null, payout: 1026n, fee: 0n, toReserveBase: 1025n }), owner)).toMatchObject({
      status: "settled", frontedBase: 1025n, premiumBase: 51n, proceedsBase: 2051n, returnedBase: 1026n,
    });
  });
  it("knocked out and cashed out keep their own states", () => {
    expect(leveragePositionOfReceipt(boost({ result: "knocked-out", resolved: null, payout: 75n, fee: 51n, toReserveBase: 1076n }), owner)).toMatchObject({
      status: "knocked-out", frontedBase: 1025n, proceedsBase: 1100n, returnedBase: 75n,
    });
    expect(leveragePositionOfReceipt(boost({ result: "sold", resolved: null, payout: 1375n, fee: 51n, toReserveBase: 1076n }), owner)).toMatchObject({
      status: "closed", proceedsBase: 2400n, returnedBase: 1375n,
    });
  });
  it("a short is a down boost", () => {
    const s = leveragePositionOfReceipt(boost({ product: "short", pick: "Down @10000bps", side: "down", result: "lost", payout: 0n, fee: 0n, toReserveBase: 0n, cost: 2000n, stakeBase: 2000n }), owner)!;
    expect(s).toMatchObject({ side: "down", leverageBps: 10_000, frontedBase: 0n, premiumBase: 0n });
    expect(endedBoosts([s ? boost({}) : base, base], owner)).toHaveLength(1);
  });
});
