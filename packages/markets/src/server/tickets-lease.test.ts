import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import type { LedgerClient } from "@agari/ledger";
import { describe, expect, it, vi } from "vitest";
import { createTicketSeat } from "./tickets";
import { toTicketSnapshot } from "./tickets-read";

/**
 * C4d H3: a seat party is recycled. Visitor A's settled parlay left a `SettlementReceipt` on party P; visitor B now
 * leases P from offset 500. B's ticket reads must not list A's receipt, and B's actions must not reach A's contracts.
 */
const VENUE = "venue::1220aa";
const P = "seat-7::1220bb";
const LEASE_START = 500;
const receipt = (marketId: string) => ({
  venue: VENUE, owner: P, marketId, pairId: "", outcome: "SideDown", resolved: "SideUp", lots: "1", cashUnit: "1", backingShare: "200", cost: "200", payout: "0", fee: "0", product: "parlay",
  detail: { reserveId: "parlay", marketIds: [marketId], pick: "Down", stake: "200", toReserve: "200", result: "lost" },
});
const round = { venue: VENUE, owner: P, reserveId: "range", termsCid: "t1", marketId: "BTC-1m:1", kind: "RangeTicket", side: "Inside", lowE8: "1", highE8: "2", stake: "10", maxPayout: "20", "expiry": "2026-09-30T00:00:00Z", refundAfter: "2026-09-30T01:00:00Z" };
const ev = (templateId: string, arg: unknown, offset: number, cid: string) => ({ contractId: cid, templateId, createArgument: arg, offset, "createdAt": "2026-09-30T00:00:00Z" });
const events = [
  ev(TEMPLATE_IDS.SettlementReceipt, receipt("BTC-1m:1"), 120, "00aa"), // A's, before B's lease
  ev(TEMPLATE_IDS.SettlementReceipt, receipt("BTC-1m:2"), 640, "00bb"), // B's own
  ev(TEMPLATE_IDS.VenueCash, { venue: VENUE, owner: P, amount: "1000", bucket: "credit" }, 90, "00cc"),
];

describe("a recycled seat's ticket reads and actions stay inside its lease (C4d H3)", () => {
  it("the snapshot leaves out every ticket contract created before the lease, and keeps cash", () => {
    const s = toTicketSnapshot(P, events as never, 700, LEASE_START);
    expect(s.receipts.map((r) => r.cid)).toEqual(["00bb"]);
    expect(s.cash.map((c) => c.cid)).toEqual(["00cc"]);
    // Without a lease bound (offset 0) both receipts are the party's: the leak this closes.
    expect(toTicketSnapshot(P, events as never, 700).receipts.map((r) => r.cid)).toEqual(["00aa", "00bb"]);
  });

  it("an exit on an earlier visitor's ticket is refused as not the seat's, before anything is sent", async () => {
    const make = () => {
      const submit = vi.fn(async () => {
        throw new Error("sent");
      });
      const client = {
        activeContracts: async ({ parties }: { parties: string[] }) =>
          parties[0] === VENUE ? { activeAtOffset: 700, contracts: [] } : { activeAtOffset: 700, contracts: [{ createdEvent: ev(TICKET_TEMPLATE_IDS.RangeRound, round, 100, "00dd") }] },
        submitAndWaitForTransaction: submit,
      } as unknown as LedgerClient;
      const journal = { get: async () => null, begin: vi.fn(async () => ({})), finish: vi.fn(async () => undefined) };
      return { submit, journal, seat: createTicketSeat({ client, venueParty: VENUE, journal: journal as never }) };
    };
    const exitAs = (fromOffset: number, m: ReturnType<typeof make>) =>
      m.seat.exit({ party: P, leaseId: "lease-B", fromOffset }, "range", "refund", { journalId: "4f0c3c55-9a8e-4d7a-9d2c-1f2e3d4c5b6a", ticketCid: "00dd" });

    const bounded = make();
    const reply = await exitAs(LEASE_START, bounded);
    expect(reply).toMatchObject({ kind: "refused", diagnosis: { kind: "already-claimed" } });
    expect(bounded.submit).not.toHaveBeenCalled();
    // The same exit without the lease bound reaches the ledger: the bound is what refuses it.
    const unbounded = make();
    await exitAs(0, unbounded);
    expect(unbounded.submit).toHaveBeenCalled();
  });
});
