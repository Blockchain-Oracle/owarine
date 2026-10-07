import { AGENT_TEMPLATE_IDS } from "@owarine/daml";
import type { Command, LedgerClient, Party } from "@owarine/ledger";
import { describe, expect, it } from "vitest";
import { strategyNumOf } from "../ops/agents/ids";
import { creatorPayoutsView } from "../ops/agents/views";
import { createAgentsSeat } from "./agents";
import { grantAgentOf } from "./agents-read";
import type { OpsClient } from "./ops-client";
import type { CommandJournal, CommandRow } from "./writes";

const VENUE = "venue::1220aa" as Party;
const A = "seat-1::1220bb" as Party;
const B = "seat-2::1220cc" as Party;
const HOUSE = "owarine-agent-runner::1220dd" as Party;
const SEAT = { party: A, leaseId: "lease-a", address: "SeatA111", fromOffset: 0 };
const J1 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0001";
const J2 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0002";
const J3 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0003";
const J4 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0004";
const UPDATE = `1220${"ab".repeat(32)}`;
const suffix = (t: string) => t.slice(t.indexOf(":"));
/** Strategy "7" as the screens number it. */
const SID = strategyNumOf("7");

interface Row { cid: string; templateId: string; data: Record<string, unknown>; seenBy: Party[]; offset: number }

const payout = (cid: string, creator: Party, period: number, feeCount: number, amount: bigint, offset = 1): Row => ({
  cid, templateId: AGENT_TEMPLATE_IDS.CreatorPayout, seenBy: [VENUE, creator], offset,
  data: { venue: VENUE, creator, period: String(period), feeCount: String(feeCount), amount: amount.toString() },
});
const ENVELOPE = { maxStakePerTrade: "5000000", maxDailySpend: "20000000", maxOpenPositions: "2", maxPriceTicks: "0" };
const terms = (creator: Party, strategyId: string) => ({ venue: VENUE, creator, strategyId, runner: HOUSE, envelope: ENVELOPE, fee: "500000", specHash: "ab", version: "0", active: true, publishedAt: null });
/** A creator-signed Strategy (the venue observes it) and the venue's listing of it (the creator observes it). */
const strategy = (creator: Party, strategyId: string, offset: number): Row[] => [
  { cid: `s-${strategyId}`, templateId: AGENT_TEMPLATE_IDS.Strategy, seenBy: [VENUE, creator], offset, data: { ...terms(creator, strategyId), spec: "{}" } },
  { cid: `l-${strategyId}`, templateId: AGENT_TEMPLATE_IDS.StrategyListing, seenBy: [VENUE, creator], offset, data: { ...terms(creator, strategyId), strategyCid: `s-${strategyId}` } },
];

/** A ledger where each party sees only the contracts it is a stakeholder of, each created at its offset, as on Canton. */
function ledger(initial: Row[]) {
  let rows = [...initial];
  const reads: Party[][] = [];
  const sent: { actAs: Party[]; commandId: string; commands: Command[] }[] = [];
  const client = {
    activeContracts: async (req: { parties: Party[]; templateIds: string[] }) => {
      reads.push(req.parties);
      const want = new Set(req.templateIds.map(suffix));
      return {
        activeAtOffset: 99,
        contracts: rows
          .filter((r) => want.has(suffix(r.templateId)) && r.seenBy.some((p) => req.parties.includes(p)))
          .map((r) => ({ synchronizerId: "sync", createdEvent: { contractId: r.cid, templateId: r.templateId, createArgument: r.data, offset: r.offset, createdEventBlob: `blob-${r.cid}` } })),
      };
    },
    submitAndWaitForTransaction: async (req: { actAs: Party[]; commandId: string; commands: Command[] }) => {
      sent.push(req);
      const claimed = req.commands.map((c) => (c as unknown as { ExerciseCommand: { contractId: string; choice: string } }).ExerciseCommand);
      rows = rows.filter((p) => !claimed.some((c) => c.contractId === p.cid && c.choice === "Payout_Claim"));
      return { transaction: { updateId: UPDATE, events: [] }, recovered: false };
    },
    findAcceptedCompletion: async () => null,
  } as unknown as LedgerClient;
  return { client, reads, sent, left: () => rows.filter((r) => r.templateId === AGENT_TEMPLATE_IDS.CreatorPayout) };
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

const seatOver = (client: LedgerClient, agentRunner: Party | null = null) =>
  createAgentsSeat({ client, venueParty: VENUE, agentRunner, journal: memoryJournal(), ops: {} as OpsClient, now: () => 1_790_000_000_000 });

describe("creator fees (C8i): the payouts waiting for a creator, and its claim", () => {
  it("adds up only the seat's own payouts, oldest period first", () => {
    const view = creatorPayoutsView(
      [payout("p2", A, 12, 2, 1_000_000n), payout("p1", A, 11, 1, 500_000n), payout("px", B, 11, 4, 9_000_000n)].map(({ data: p }) => ({
        venue: VENUE, creator: p.creator as Party, period: Number(p.period), feeCount: Number(p.feeCount), amount: BigInt(String(p.amount)),
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

describe("a recycled seat inherits nothing of the earlier visitor on its party (C8i, H1)", () => {
  // Visitor 1 held party A from offset 5: it published strategy "7" at offset 12, and a payout of its fees landed at 20.
  // Visitor 2 holds the same party from offset 50.
  const visitor1 = { party: A, leaseId: "lease-1", address: "SeatA111", fromOffset: 5 };
  const visitor2 = { party: A, leaseId: "lease-2", address: "SeatB222", fromOffset: 50 };
  const setup = () => ledger([payout("p1", A, 497428, 1, 500_000n, 20), ...strategy(A, "7", 12)]);

  it("the next visitor sees no payout, cannot claim it, and the registry never shows the old strategy as theirs", async () => {
    const l = setup();
    const seat = seatOver(l.client, HOUSE);
    expect((await seat.payouts(visitor2)).totalBase).toBe(0n);
    const claim = await seat.claimPayouts(visitor2, { journalId: J1 });
    expect(claim.kind === "refused" && claim.diagnosis.kind).toBe("already-claimed");
    expect(l.sent).toHaveLength(0);
    expect(l.left().map((p) => p.cid)).toEqual(["p1"]);
    // Labelled by the current lease: the old strategy shows its party, never visitor 2's address.
    const now = await seat.strategies(new Map([[A, { address: visitor2.address, fromOffset: visitor2.fromOffset }]]));
    expect(now.map((s) => s.creator)).toEqual([A]);
    const then = await seat.strategies(new Map([[A, { address: visitor1.address, fromOffset: visitor1.fromOffset }]]));
    expect(then.map((s) => s.creator)).toEqual([visitor1.address]);
  });

  it("the next visitor cannot revise, re-run or deactivate the earlier visitor's strategy", async () => {
    const l = setup();
    const seat = seatOver(l.client, HOUSE);
    const replies = [
      await seat.update(visitor2, { journalId: J1, strategyId: SID, metadata: "{}", feeBase: 0n }),
      await seat.setRunner(visitor2, { journalId: J2, strategyId: SID, runner: HOUSE }),
      await seat.deactivate(visitor2, { journalId: J3, strategyId: SID }),
    ];
    for (const r of replies) {
      expect(r.kind).toBe("refused");
      expect(r.kind === "refused" && r.diagnosis.technical).toMatch(/not published from this seat's lease/);
    }
    expect(l.sent).toHaveLength(0);
  });

  it("the visitor who published it still sees and claims its own", async () => {
    const l = setup();
    const seat = seatOver(l.client, HOUSE);
    expect((await seat.payouts(visitor1)).totalBase).toBe(500_000n);
    expect((await seat.claimPayouts(visitor1, { journalId: J1 })).kind).toBe("confirmed");
    expect((await seat.deactivate(visitor1, { journalId: J2, strategyId: SID })).kind).toBe("confirmed");
    expect(l.sent.map((x) => x.actAs)).toEqual([[A], [A]]);
  });
});

describe("a strategy runs on the house runner, and a grant names only the house agent (C8i, L5, finding 5)", () => {
  const mine = { party: A, leaseId: "lease-1", address: "SeatA111", fromOffset: 5 };
  const choiceArg = (i: number, l: ReturnType<typeof ledger>) => (l.sent[i]!.commands[0] as unknown as { ExerciseCommand: { choiceArgument: Record<string, unknown> } }).ExerciseCommand.choiceArgument;
  const envelope = { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 20_000_000n, maxOpenPositions: 2, maxPriceRaw: 0n };

  it("refuses any other party as runner, on publish and on a runner change, before anything is sent", async () => {
    const l = ledger([...strategy(A, "7", 12), { cid: "lic", templateId: AGENT_TEMPLATE_IDS.CreatorLicense, seenBy: [VENUE, A], offset: 1, data: { venue: VENUE, creator: A, nextIndex: "1" } }]);
    const seat = seatOver(l.client, HOUSE);
    for (const runner of [B, VENUE, "someone-else::1220ee"]) {
      const pub = await seat.publish(mine, { journalId: J1, runner, envelope, feeBase: 0n, metadata: "{}" });
      expect(pub.kind === "refused" && pub.diagnosis.technical).toMatch(/runs on the house runner/);
      const set = await seat.setRunner(mine, { journalId: J2, strategyId: SID, runner });
      expect(set.kind === "refused" && set.diagnosis.technical).toMatch(/runs on the house runner/);
    }
    expect(l.sent).toHaveLength(0);
  });

  it("refuses the creator's own seat as runner: its party is recycled with the seat, and grants naming it would outlive the lease", async () => {
    const l = ledger([...strategy(A, "7", 12), { cid: "lic", templateId: AGENT_TEMPLATE_IDS.CreatorLicense, seenBy: [VENUE, A], offset: 1, data: { venue: VENUE, creator: A, nextIndex: "1" } }]);
    const seat = seatOver(l.client, HOUSE);
    for (const runner of [mine.address, mine.party]) {
      const pub = await seat.publish(mine, { journalId: J1, runner, envelope, feeBase: 0n, metadata: "{}" });
      expect(pub.kind === "refused" && pub.diagnosis.technical).toMatch(/recycled with the seat/);
      const set = await seat.setRunner(mine, { journalId: J2, strategyId: SID, runner });
      expect(set.kind === "refused" && set.diagnosis.technical).toMatch(/recycled with the seat/);
    }
    expect(l.sent).toHaveLength(0);
  });

  it("accepts the house runner", async () => {
    const l = ledger(strategy(A, "7", 12));
    const seat = seatOver(l.client, HOUSE);
    expect((await seat.setRunner(mine, { journalId: J3, strategyId: SID, runner: HOUSE })).kind).toBe("confirmed");
    expect(choiceArg(0, l).newRunner).toBe(HOUSE);
  });

  it("refuses a grant to any agent but the house agent-runner (the strategy runner and X executor), before anything is sent", async () => {
    const l = ledger(strategy(A, "7", 12));
    const seat = seatOver(l.client, HOUSE);
    const caps = { maxStakePerTradeBase: 1_000_000n, maxDailySpendBase: 5_000_000n, maxOpenPositions: 1, maxPriceRaw: 850_000n };
    for (const actor of [B, mine.party, mine.address, VENUE]) {
      const r = await seat.openGrant(mine, { journalId: J4, kind: "strategy", actor, caps, expiresAtSec: 1_790_000_000 + 86_400, budgetBase: 5_000_000n });
      expect(r.kind === "refused" && r.diagnosis.technical).toMatch(/this venue's agent/);
    }
    expect(l.sent).toHaveLength(0);
    expect(grantAgentOf(HOUSE, HOUSE)).toBe(HOUSE);
    expect(() => grantAgentOf(HOUSE, null)).toThrow(/this venue's agent/);
  });
});

describe("the calling seat's own label counts from its lease's start (C8i, after C4c's caller relabel)", () => {
  it("a recycled seat proving its own key is never shown as creator of the previous visitor's strategy", async () => {
    const l = ledger(strategy(A, "7", 12));
    const seat = seatOver(l.client, HOUSE);
    // The strategy was created at offset 12. The caller's lease began at 50 (a later visitor on the same party).
    const recycled = await seat.strategies(new Map([[A, { address: "phone-c", fromOffset: 50 }]]));
    expect(recycled[0]!.creator).toBe(A);
    // The visitor whose lease began at 5 is its creator, by the key it proves.
    const own = await seat.strategies(new Map([[A, { address: "phone-a", fromOffset: 5 }]]));
    expect(own[0]!.creator).toBe("phone-a");
  });
});
