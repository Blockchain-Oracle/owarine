import { TEMPLATE_IDS } from "@owarine/daml";
import { LedgerError, type LedgerClient } from "@owarine/ledger";
import { describe, expect, it } from "vitest";
import { appMarketId } from "./ids";
import { publishCall, publishCommandId, readPublications, retractCall } from "./publish";
import type { SeatReader, SeatSnapshot } from "./reads";

const SEAT = "seat-1::1220aa";
const OTHER = "seat-2::1220bb";
const M = "BTC-1m:42";
const MID = appMarketId(M);

const publication = (cid: string, owner: string, handle: string, pairId: string, product: string | null = null) => ({
  createdEvent: {
    contractId: cid,
    templateId: TEMPLATE_IDS.Publication,
    createArgument: { venue: "venue::1220", owner, handle, marketId: M, pairId, outcome: "SideUp", lots: "3", backingShare: "186000", product },
  },
});

function fakes(o: { published: ReturnType<typeof publication>[]; legPairs: string[]; submit?: () => Promise<unknown> }) {
  const submitted: { actAs: string[]; commandId: string; commands: unknown[] }[] = [];
  const client = {
    activeContracts: async () => ({ contracts: o.published, activeAtOffset: 10 }),
    submitAndWaitForTransaction: async (req: { actAs: string[]; commandId: string; commands: unknown[] }) => {
      submitted.push(req);
      if (o.submit) await o.submit();
      return { transaction: { updateId: "u1", events: [] }, recovered: false };
    },
  } as unknown as LedgerClient;
  const snap = { party: SEAT, offset: 10, cash: [], quotes: [], legs: o.legPairs.map((pairId, i) => ({ cid: `00leg${i}`, marketId: MID, pairId })) } as unknown as SeatSnapshot;
  const seats: SeatReader = { read: async () => snap, invalidate: () => undefined };
  return { client, seats, submitted };
}

const actor = { party: SEAT, leaseId: "lease-1", handle: "SeatAddr1" };

describe("publications", () => {
  it("reads only this seat's publications under this lease's handle", async () => {
    const { client } = fakes({ published: [publication("p1", SEAT, "SeatAddr1", "a"), publication("p2", SEAT, "OldVisitor", "b"), publication("p3", OTHER, "SeatAddr1", "c")], legPairs: [] });
    const rows = await readPublications(client, SEAT, "SeatAddr1");
    expect(rows.map((r) => r.cid)).toEqual(["p1"]);
    expect(rows[0]).toMatchObject({ marketId: MID, side: "up", lots: 3n });
  });

  it("publishes each live leg once, as the seat only, and skips pairs already published", async () => {
    const f = fakes({ published: [publication("p1", SEAT, "SeatAddr1", "a")], legPairs: ["a", "b"] });
    const r = await publishCall(f, actor, { marketId: MID, source: "leg" });
    expect(r.kind).toBe("published");
    expect(f.submitted).toHaveLength(1);
    expect(f.submitted[0]!.actAs).toEqual([SEAT]);
    expect(f.submitted[0]!.commands).toEqual([{ ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: "00leg1", choice: "Leg_Publish", choiceArgument: { handle: "SeatAddr1" } } }]);
    expect(f.submitted[0]!.commandId).toBe(publishCommandId("lease-1", ["00leg1"]));
  });

  it("answers already-published, nothing-live and receipt-unavailable without a command", async () => {
    const done = fakes({ published: [publication("p1", SEAT, "SeatAddr1", "a")], legPairs: ["a"] });
    expect((await publishCall(done, actor, { marketId: MID, source: "leg" })).kind).toBe("already");
    const settled = fakes({ published: [], legPairs: [] });
    expect(await publishCall(settled, actor, { marketId: MID, source: "leg" })).toMatchObject({ kind: "refused", code: "nothing-live" });
    expect(await publishCall(settled, actor, { marketId: MID, source: "receipt" })).toMatchObject({ kind: "refused", code: "receipt-unavailable" });
    expect(done.submitted.length + settled.submitted.length).toBe(0);
  });

  it("publishes a settled call from this lease's receipts only, each pair once; a ticket by its receipt id", async () => {
    const receipt = (cid: string, pairId: string, offset: number, product: string | null = null) => ({
      createdEvent: {
        contractId: cid, offset, templateId: TEMPLATE_IDS.SettlementReceipt,
        createArgument: {
          venue: "venue::1220", owner: SEAT, marketId: M, pairId, outcome: "SideUp", resolved: "SideUp", lots: "3", cashUnit: "1000", backingShare: "186000",
          cost: "190000", payout: "3000000", fee: "4000", product, detail: null,
        },
      },
    });
    const f = fakes({ published: [receipt("r-old", "z", 5), receipt("r1", "a", 20), receipt("r2", "b", 21), receipt("t1", "", 22, "range"), publication("p1", SEAT, "SeatAddr1", "a")] as never, legPairs: [] });
    const lease = { ...actor, fromOffset: 10 };
    expect((await publishCall(f, lease, { marketId: MID, source: "receipt" })).kind).toBe("published");
    expect(f.submitted[0]!.commands).toEqual([{ ExerciseCommand: { templateId: TEMPLATE_IDS.SettlementReceipt, contractId: "r2", choice: "Receipt_Publish", choiceArgument: { handle: "SeatAddr1" } } }]);
    expect((await publishCall(f, lease, { marketId: MID, source: "receipt", receiptId: "t1" })).kind).toBe("published");
    expect(f.submitted[1]!.commands).toEqual([{ ExerciseCommand: { templateId: TEMPLATE_IDS.SettlementReceipt, contractId: "t1", choice: "Receipt_Publish", choiceArgument: { handle: "SeatAddr1" } } }]);
    expect(await publishCall(f, lease, { marketId: MID, source: "receipt", receiptId: "r-old" })).toMatchObject({ kind: "refused", code: "receipt-unavailable" });
  });

  it("retracts one product on a Window: a pair leg's retract keeps the ticket's publication and vice versa (C6e)", async () => {
    const both = () => fakes({ published: [publication("p-leg", SEAT, "SeatAddr1", "a"), publication("p-range", SEAT, "SeatAddr1", "", "range"), publication("p-old", SEAT, "OldVisitor", "b")], legPairs: [] });
    const retracted = (f: ReturnType<typeof fakes>) => f.submitted.flatMap((s) => (s.commands as Array<{ ExerciseCommand: { contractId: string; choice: string } }>).map((c) => `${c.ExerciseCommand.choice} ${c.ExerciseCommand.contractId}`));

    const legOnly = both();
    expect(await retractCall(legOnly, actor, { marketId: MID })).toEqual({ retracted: 1 });
    expect(retracted(legOnly)).toEqual(["Publication_Retract p-leg"]);
    expect(legOnly.submitted[0]!.actAs).toEqual([SEAT]);

    const ticketOnly = both();
    expect(await retractCall(ticketOnly, actor, { marketId: MID, product: "range" })).toEqual({ retracted: 1 });
    expect(retracted(ticketOnly)).toEqual(["Publication_Retract p-range"]);

    // Another product, or another Window, retracts nothing and sends no command.
    const none = both();
    expect(await retractCall(none, actor, { marketId: MID, product: "boost" })).toEqual({ retracted: 0 });
    expect(await retractCall(none, actor, { marketId: appMarketId("BTC-1m:43") })).toEqual({ retracted: 0 });
    expect(none.submitted).toHaveLength(0);
  });

  it("treats a duplicate command as the earlier publish having landed", async () => {
    const f = fakes({ published: [], legPairs: ["a"], submit: async () => { throw new LedgerError({ kind: "duplicate", status: 409, path: "/v2/commands", message: "DUPLICATE_COMMAND" }); } });
    expect((await publishCall(f, actor, { marketId: MID, source: "leg" })).kind).toBe("published");
  });
});
