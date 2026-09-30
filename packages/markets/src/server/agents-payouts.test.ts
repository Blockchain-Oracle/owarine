import { AGENT_TEMPLATE_IDS } from "@agari/daml";
import type { Command, LedgerClient, Party } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { creatorPayoutsView } from "../ops/agents/views";
import { createAgentsSeat } from "./agents";
import type { OpsClient } from "./ops-client";
import type { CommandJournal, CommandRow } from "./writes";

const VENUE = "venue::1220aa" as Party;
const A = "seat-1::1220bb" as Party;
const B = "seat-2::1220cc" as Party;
const SEAT = { party: A, leaseId: "lease-a", address: "SeatA111" };
const J1 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0001";
const J2 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0002";
const UPDATE = `1220${"ab".repeat(32)}`;

const payout = (cid: string, creator: Party, period: number, feeCount: number, amount: bigint) => ({
  cid,
  data: { venue: VENUE, creator, period: String(period), feeCount: String(feeCount), amount: amount.toString() },
});

/** A ledger holding `CreatorPayout`s: each party sees only the ones it is the creator (observer) of, as on Canton. */
function ledger(initial: ReturnType<typeof payout>[]) {
  let payouts = [...initial];
  const reads: Party[][] = [];
  const sent: { actAs: Party[]; commandId: string; commands: Command[] }[] = [];
  const client = {
    activeContracts: async (req: { parties: Party[] }) => {
      reads.push(req.parties);
      return {
        activeAtOffset: 7,
        contracts: payouts
          .filter((p) => req.parties.includes(p.data.creator))
          .map((p) => ({ synchronizerId: "sync", createdEvent: { contractId: p.cid, templateId: AGENT_TEMPLATE_IDS.CreatorPayout, createArgument: p.data } })),
      };
    },
    submitAndWaitForTransaction: async (req: { actAs: Party[]; commandId: string; commands: Command[] }) => {
      sent.push(req);
      const claimed = req.commands.map((c) => (c as unknown as { ExerciseCommand: { contractId: string; choice: string } }).ExerciseCommand);
      payouts = payouts.filter((p) => !claimed.some((c) => c.contractId === p.cid && c.choice === "Payout_Claim"));
      return { transaction: { updateId: UPDATE, events: [] }, recovered: false };
    },
    findAcceptedCompletion: async () => null,
  } as unknown as LedgerClient;
  return { client, reads, sent, left: () => payouts };
}

function memoryJournal(): CommandJournal {
  const rows = new Map<string, CommandRow>();
  return {
    begin: async (row, nowMs) => {
      const stored = rows.get(row.commandId) ?? { ...row, state: "pending", updateId: null, diagnosis: null, createdAtMs: nowMs };
      rows.set(row.commandId, stored);
      return stored;
    },
    finish: async (commandId, patch) => {
      const row = rows.get(commandId);
      if (row) rows.set(commandId, { ...row, state: patch.state, updateId: patch.updateId ?? row.updateId, diagnosis: patch.diagnosis ?? null });
    },
    get: async (commandId) => rows.get(commandId) ?? null,
  };
}

const seatOver = (client: LedgerClient) =>
  createAgentsSeat({ client, venueParty: VENUE, agentRunner: null, journal: memoryJournal(), ops: {} as OpsClient, now: () => 1_790_000_000_000 });

describe("creator fees (C8i): the payouts waiting for a creator, and its claim", () => {
  it("adds up only the seat's own payouts, oldest period first", () => {
    const view = creatorPayoutsView(
      [payout("p2", A, 12, 2, 1_000_000n), payout("p1", A, 11, 1, 500_000n), payout("px", B, 11, 4, 9_000_000n)].map((p) => ({
        venue: VENUE, creator: p.data.creator, period: Number(p.data.period), feeCount: Number(p.data.feeCount), amount: BigInt(p.data.amount),
      })),
      A,
    );
    expect(view).toEqual({ totalBase: 1_500_000n, feeCount: 3, payouts: [{ period: 11, feeCount: 1, amountBase: 500_000n }, { period: 12, feeCount: 2, amountBase: 1_000_000n }] });
  });

  it("reads the waiting fees AS the leased seat, never as the venue", async () => {
    const l = ledger([payout("p1", A, 497428, 1, 500_000n), payout("pb", B, 497428, 3, 1_500_000n)]);
    const view = await seatOver(l.client).payouts(SEAT);
    expect(view.totalBase).toBe(500_000n);
    expect(view.feeCount).toBe(1);
    expect(l.reads.every((parties) => parties.length === 1 && parties[0] === A)).toBe(true);
  });

  it("claims every waiting payout in one command acting as the seat alone, and nothing is left to claim twice", async () => {
    const l = ledger([payout("p1", A, 497428, 1, 500_000n), payout("p2", A, 497429, 2, 1_000_000n), payout("pb", B, 497428, 3, 1_500_000n)]);
    const seat = seatOver(l.client);
    const reply = await seat.claimPayouts(SEAT, { journalId: J1 });
    expect(reply).toEqual({ kind: "confirmed", updateId: UPDATE, recovered: false });
    expect(l.sent).toHaveLength(1);
    expect(l.sent[0]!.actAs).toEqual([A]);
    expect(l.sent[0]!.commandId).toBe(`agent:${J1}`);
    const claims = l.sent[0]!.commands.map((c) => (c as unknown as { ExerciseCommand: { contractId: string; choice: string } }).ExerciseCommand);
    expect(claims.map((c) => [c.contractId, c.choice])).toEqual([["p1", "Payout_Claim"], ["p2", "Payout_Claim"]]);
    // Another creator's payout is not the seat's to claim, and stays.
    expect(l.left().map((p) => p.cid)).toEqual(["pb"]);
    expect((await seat.payouts(SEAT)).totalBase).toBe(0n);

    // The same journal id is answered from the journal, never sent again.
    expect(await seat.claimPayouts(SEAT, { journalId: J1 })).toEqual({ kind: "confirmed", updateId: UPDATE, recovered: true });
    expect(l.sent).toHaveLength(1);
    // A new claim with nothing waiting is refused before anything is sent.
    const again = await seat.claimPayouts(SEAT, { journalId: J2 });
    expect(again.kind).toBe("refused");
    expect(again.kind === "refused" && again.diagnosis.kind).toBe("already-claimed");
    expect(l.sent).toHaveLength(1);
  });
});
