import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import type { ActiveContract, Command, CreatedEvent, LedgerClient } from "@owarine/ledger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleSession } from "../canton/session";
import { railPass, readRail, resetRailClock, type RailDeps } from "./rail";
import type { RegistryClient } from "./registry";

const VENUE = "venue::1";
const ADMIN = "dso::1";
const ALICE = "alice::1";
const PKG = "abcd";
const RATE = "100000";

let offset = 100;
const created = (templateId: string, contractId: string, createArgument: unknown, more: Partial<CreatedEvent> = {}): ActiveContract => ({
  synchronizerId: "sync::1",
  createdEvent: { offset: ++offset, nodeId: 0, contractId, templateId: `${PKG}:${templateId.slice(templateId.indexOf(":") + 1)}`, packageName: "x", createArgument, witnessParties: [VENUE], signatories: [VENUE], "createdAt": "2026-10-01T12:00:00Z", ...more },
});

const TERMS = { instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE };
const LISTING = created(CC_TEMPLATE_IDS.CcListing, "listing", {
  venue: VENUE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, minDepositUnits: "100", maxDepositUnits: "100000000000", depositsOpen: true,
});
const ACCOUNT = created(TEMPLATE_IDS.VenueAccount, "acct-alice", { venue: VENUE, owner: ALICE, label: "x" });
const holdingView = (owner: string, amount: string, lock: unknown = null) => ({ owner, instrumentId: { admin: ADMIN, id: "Amulet" }, amount, lock, meta: { values: {} } });
const withViews = (templateId: string, cid: string, views: { interfaceId: string; viewValue: unknown }[], more: Partial<CreatedEvent> = {}): ActiveContract => ({
  ...created(templateId, cid, {}, more),
  createdEvent: { ...created(templateId, cid, {}, more).createdEvent, interfaceViews: views.map((v) => ({ ...v, viewStatus: { code: 0 } })) },
});
const instrView = (sender: string, receiver: string, amount: string) => ({
  originalInstructionCid: null,
  transfer: { sender, receiver, amount, instrumentId: { admin: ADMIN, id: "Amulet" }, requestedAt: "2026-10-01T11:59:00Z", executeBefore: "2026-10-01T18:00:00Z", inputHoldingCids: [], meta: { values: {} } },
  status: { tag: "TransferPendingReceiverAcceptance", value: {} },
  meta: { values: {} },
});

function harness(o: { templates: ActiveContract[]; views: ActiveContract[]; failSubmit?: (cmd: Command) => boolean }) {
  const submitted: { commandId: string; commands: Command[]; disclosedContracts?: unknown }[] = [];
  const client = {
    activeContracts: vi.fn(async (q: { interfaceIds?: string[] }) => ({ contracts: q.interfaceIds ? o.views : o.templates, activeAtOffset: 1 })),
    submitAndWaitForTransaction: vi.fn(async (s: { commandId: string; commands: Command[]; disclosedContracts?: unknown }) => {
      if (o.failSubmit?.(s.commands[0] as Command)) throw new Error("rejected");
      submitted.push(s);
      return { transaction: { updateId: "u", events: [], offset: 1, effectiveAt: "", synchronizerId: "s", recordTime: "" }, recovered: false };
    }),
    connectedSynchronizers: vi.fn(async () => [{ synchronizerAlias: "a", synchronizerId: "sync::1" }]),
  } as unknown as LedgerClient;
  const venue: RoleSession = { role: "venue", party: VENUE, client, dryRun: false };
  return { venue, submitted, client };
}

const ctx = { choiceContextData: { values: {} }, disclosedContracts: [{ templateId: "p:M:T", contractId: "00c", createdEventBlob: "b", synchronizerId: "sync::1" }] };
const registry = (): RegistryClient & { instructionContext: ReturnType<typeof vi.fn>; transferFactory: ReturnType<typeof vi.fn> } => ({
  instructionContext: vi.fn(async () => ctx),
  transferFactory: vi.fn(async () => ({ factoryId: "00factory", transferKind: "offer" as const, context: ctx })),
});

const deps = (h: ReturnType<typeof harness>, reg: RegistryClient | null, more: Partial<RailDeps> = {}): RailDeps => ({
  venue: h.venue, registry: reg, listingId: "cc-1", nowSec: () => Date.parse("2026-10-01T12:00:00Z") / 1000, log: () => {}, refundAfterSec: 3600, transferWindowSec: 3600, attestEverySec: 0, ...more,
});

const choiceOf = (c: Command) => ("ExerciseCommand" in c ? c.ExerciseCommand.choice : "CreateCommand" in c ? "create" : "other");

beforeEach(() => {
  resetRailClock();
  offset = 100;
});

describe("the rail's venue pass (C7b, against a fake ledger and a fake registry)", () => {
  it("reads the venue's view: listing, account, holdings and the transfers to it", async () => {
    const h = harness({
      templates: [LISTING, ACCOUNT],
      views: [
        withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "instr1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "12.5000000000") }], { signatories: [ALICE, ADMIN] }),
        withViews("pkg:Splice.Amulet:Amulet", "hold1", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(VENUE, "3.0000000000") }], { signatories: [VENUE, ADMIN] }),
        withViews("pkg:Splice.Amulet:Amulet", "alices", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(ALICE, "9.0000000000") }]),
      ],
    });
    const snap = await readRail(h.venue, "cc-1");
    expect(snap.listing?.data.unitsPerCoin).toBe(100_000n);
    expect(snap.accounts.get(ALICE)).toBe("acct-alice");
    expect(snap.incoming.map((i) => [i.cid, i.view.amountAtomic])).toEqual([["instr1", 125_000_000_000n]]);
    expect(snap.holdings.map((x) => x.cid)).toEqual(["hold1"]);
    // the interface read is by InterfaceFilter, both interfaces
    const q = (h.client.activeContracts as unknown as { mock: { calls: unknown[][] } }).mock.calls[1]?.[0] as { interfaceIds: string[] };
    expect(q.interfaceIds).toEqual([CIP56_INTERFACE_IDS.Holding, CIP56_INTERFACE_IDS.TransferInstruction]);
  });

  it("settles a genuine deposit with the registry's accept context and disclosed contracts, then attests", async () => {
    const h = harness({
      templates: [LISTING, ACCOUNT],
      views: [withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "instr1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "12.5000000000") }], { signatories: [ALICE, ADMIN] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg));
    expect(r.settled).toBe(1);
    expect(reg.instructionContext).toHaveBeenCalledWith("accept", "instr1");
    const settle = h.submitted.find((s) => choiceOf(s.commands[0] as Command) === "Listing_SettleDeposit");
    expect(settle?.disclosedContracts).toEqual(ctx.disclosedContracts);
    const arg = (settle?.commands[0] as { ExerciseCommand: { contractId: string; choiceArgument: Record<string, unknown> } }).ExerciseCommand;
    expect(arg.contractId).toBe("listing");
    expect(arg.choiceArgument).toMatchObject({ instructionCid: "instr1", accountCid: "acct-alice", allowanceCid: null });
    expect(r.attested).toBe(true);
    expect(h.submitted.map((s) => choiceOf(s.commands[0] as Command))).toContain("Listing_Attest");
  });

  it("does not touch an instruction the registry did not sign", async () => {
    const h = harness({
      templates: [LISTING, ACCOUNT],
      views: [withViews("evil:Fake:Instruction", "fake", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "999.0000000000") }], { signatories: [ALICE, "attacker::1"] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg));
    expect(r.settled + r.rejected).toBe(0);
    expect(reg.instructionContext).not.toHaveBeenCalled();
    expect(h.submitted.some((s) => choiceOf(s.commands[0] as Command) === "Listing_SettleDeposit")).toBe(false);
  });

  it("rejects dust back to the sender rather than keeping it", async () => {
    const h = harness({
      templates: [LISTING, ACCOUNT],
      views: [withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "dusty", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "1.0000010000") }], { signatories: [ALICE, ADMIN] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg));
    expect(r.rejected).toBe(1);
    expect(reg.instructionContext).toHaveBeenCalledWith("reject", "dusty");
    expect(h.submitted.map((s) => choiceOf(s.commands[0] as Command))).toContain("TransferInstruction_Reject");
  });

  it("answers a covered withdrawal proposal: the factory's context, exact inputs, exact cash", async () => {
    const h = harness({
      templates: [
        LISTING, ACCOUNT,
        created(CC_TEMPLATE_IDS.CcAllowance, "al-alice", { venue: VENUE, auditor: "aud::1", owner: ALICE, listingId: "cc-1", ...TERMS, units: "1000000" }),
        created(CC_TEMPLATE_IDS.CcWithdrawProposal, "prop1", { owner: ALICE, venue: VENUE, listingId: "cc-1", ...TERMS, units: "400000", "validUntil": "2026-10-01T13:00:00Z", ref: "w-1" }, { signatories: [ALICE] }),
        created(TEMPLATE_IDS.VenueCash, "cash1", { venue: VENUE, owner: ALICE, amount: "1000000", bucket: "cc:cc-1" }),
      ],
      views: [withViews("pkg:Splice.Amulet:Amulet", "hold1", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(VENUE, "10.0000000000") }], { signatories: [VENUE, ADMIN] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg));
    expect(r.accepted).toBe(1);
    const asked = (reg.transferFactory.mock.calls[0] as unknown[])[0] as { transfer: { amount: string; sender: string; receiver: string; inputHoldingCids: string[]; meta: { values: Record<string, string> } } };
    expect(asked.transfer).toMatchObject({ amount: "4.0000000000", sender: VENUE, receiver: ALICE, inputHoldingCids: ["hold1"] });
    expect(asked.transfer.meta.values["abu-pm.io/ref"]).toBe("w-1");
    const accept = h.submitted.find((s) => choiceOf(s.commands[0] as Command) === "Proposal_Accept");
    const c = (accept?.commands[0] as { ExerciseCommand: { contractId: string; choiceArgument: Record<string, unknown> } }).ExerciseCommand;
    expect(c.contractId).toBe("prop1");
    expect(c.choiceArgument).toMatchObject({ listingCid: "listing", accountCid: "acct-alice", cashCids: ["cash1"], allowanceCid: "al-alice", factoryCid: "00factory", inputHoldingCids: ["hold1"] });
    expect(accept?.disclosedContracts).toEqual(ctx.disclosedContracts);
    // the venue reads as the owner too, so the ledger can check the owner holds the coin a registry says it delivered
    expect((accept as unknown as { readAs?: string[] }).readAs).toEqual([ALICE]);
  });

  it("never picks a look-alike holding as a transfer input, and does not count it in the statement", async () => {
    const h = harness({
      templates: [
        LISTING, ACCOUNT,
        created(CC_TEMPLATE_IDS.CcAllowance, "al-alice", { venue: VENUE, auditor: "aud::1", owner: ALICE, listingId: "cc-1", ...TERMS, units: "1000000" }),
        created(CC_TEMPLATE_IDS.CcWithdrawProposal, "prop1", { owner: ALICE, venue: VENUE, listingId: "cc-1", ...TERMS, units: "400000", "validUntil": "2026-10-01T13:00:00Z", ref: "w-1" }, { signatories: [ALICE] }),
        created(TEMPLATE_IDS.VenueCash, "cash1", { venue: VENUE, owner: ALICE, amount: "1000000", bucket: "cc:cc-1" }),
      ],
      views: [
        withViews("evil:Fake:Holding", "fake", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(VENUE, "9999999.0000000000") }], { signatories: [VENUE, "attacker::1"] }),
        withViews("pkg:Splice.Amulet:Amulet", "real", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(VENUE, "10.0000000000") }], { signatories: [VENUE, ADMIN] }),
      ],
    });
    const reg = registry();
    await railPass(deps(h, reg));
    const asked = (reg.transferFactory.mock.calls[0] as unknown[])[0] as { transfer: { inputHoldingCids: string[] } };
    expect(asked.transfer.inputHoldingCids).toEqual(["real"]);
    const attest = h.submitted.find((s) => choiceOf(s.commands[0] as Command) === "Listing_Attest");
    const arg = (attest?.commands[0] as { ExerciseCommand: { choiceArgument: { holdingCids: string[] } } }).ExerciseCommand.choiceArgument;
    expect(arg.holdingCids).toEqual(["real"]);
  });

  it("spends at most maxRejectsPerPass rejects, after every settle, so a flood of dust from known senders cannot starve real work", async () => {
    const dust = (n: number) => withViews("pkg:Splice.Amulet:AmuletTransferInstruction", `dust${n}`, [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "1.0000010000") }], { signatories: [ALICE, ADMIN] });
    const h = harness({ templates: [LISTING, ACCOUNT], views: [dust(1), dust(2), dust(3), dust(4)] });
    const reg = registry();
    const r = await railPass(deps(h, reg, { maxRejectsPerPass: 2 }));
    expect(r.rejected).toBe(2);
    expect(reg.instructionContext).toHaveBeenCalledTimes(2);
  });

  it("skips a seat that was re-leased while the pass was running (K-224)", async () => {
    const h = harness({
      templates: [LISTING, ACCOUNT],
      views: [withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "instr1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "12.5000000000") }], { signatories: [ALICE, ADMIN] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg, { leaseOf: () => ({ startOffset: 1 }), freshLease: async () => ({ startOffset: 10_000 }) }));
    expect(r.settled).toBe(0);
    expect(reg.instructionContext).not.toHaveBeenCalled();
  });

  it("alerts, and sends nothing, for a transfer the owner rejected outside the receipt", async () => {
    const withdrawal = created(CC_TEMPLATE_IDS.CcWithdrawal, "wd1", {
      venue: VENUE, owner: ALICE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units: "200000", sentAtomic: "20000000000",
      state: "WdSent", instructionCid: "gone1", openedAt: "2026-10-01T11:00:00Z", ref: "w",
    });
    const log = vi.fn();
    const h = harness({ templates: [LISTING, ACCOUNT, withdrawal], views: [] });
    const r = await railPass(deps(h, registry(), { log, history: async (cids) => new Map(cids.map((c) => [c, "rejected" as const])) }));
    expect(r.orphaned).toBe(1);
    expect(r.refunded).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ALERT"));
    expect(h.submitted.map((s) => choiceOf(s.commands[0] as Command))).not.toContain("Withdrawal_RefundReturned");
  });

  it("folds an owner's allowance in pieces into one", async () => {
    const h = harness({
      templates: [
        LISTING, ACCOUNT,
        created(CC_TEMPLATE_IDS.CcAllowance, "al-1", { venue: VENUE, auditor: "aud::1", owner: ALICE, listingId: "cc-1", ...TERMS, units: "100" }),
        created(CC_TEMPLATE_IDS.CcAllowance, "al-2", { venue: VENUE, auditor: "aud::1", owner: ALICE, listingId: "cc-1", ...TERMS, units: "50" }),
      ],
      views: [],
    });
    const r = await railPass(deps(h, registry()));
    expect(r.merged).toBe(1);
    const m = h.submitted.find((s) => choiceOf(s.commands[0] as Command) === "Allowance_Merge");
    const c = (m?.commands[0] as { ExerciseCommand: { contractId: string; choiceArgument: { others: string[] } } }).ExerciseCommand;
    expect(c.contractId).toBe("al-1");
    expect(c.choiceArgument.others).toEqual(["al-2"]);
  });

  it("declines what the owner did not deposit and never asks the registry", async () => {
    const h = harness({
      templates: [
        LISTING, ACCOUNT,
        created(CC_TEMPLATE_IDS.CcWithdrawProposal, "prop1", { owner: ALICE, venue: VENUE, listingId: "cc-1", ...TERMS, units: "400000", "validUntil": "2026-10-01T13:00:00Z", ref: "w-1" }, { signatories: [ALICE] }),
        created(TEMPLATE_IDS.VenueCash, "cash1", { venue: VENUE, owner: ALICE, amount: "9000000", bucket: "payout" }),
      ],
      views: [withViews("pkg:Splice.Amulet:Amulet", "hold1", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(VENUE, "10.0000000000") }], { signatories: [VENUE, ADMIN] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg));
    expect(r.declined).toBe(1);
    expect(reg.transferFactory).not.toHaveBeenCalled();
    expect(h.submitted.map((s) => choiceOf(s.commands[0] as Command))).toContain("Proposal_Decline");
  });

  it("takes back an unaccepted transfer after its window and refunds", async () => {
    const withdrawal = created(CC_TEMPLATE_IDS.CcWithdrawal, "wd1", {
      venue: VENUE, owner: ALICE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units: "200000", sentAtomic: "20000000000",
      state: "WdSent", instructionCid: "out1", openedAt: "2026-10-01T09:00:00Z", ref: "w",
    });
    const h = harness({
      templates: [LISTING, ACCOUNT, withdrawal],
      views: [withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "out1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(VENUE, ALICE, "2.0000000000") }], { signatories: [VENUE, ADMIN] })],
    });
    const reg = registry();
    const r = await railPass(deps(h, reg));
    expect(r.refunded).toBe(1);
    expect(reg.instructionContext).toHaveBeenCalledWith("withdraw", "out1");
    expect(h.submitted.map((s) => choiceOf(s.commands[0] as Command))).toContain("Withdrawal_Refund");
  });

  it("records a transfer the owner accepted (instruction gone, history says accepted) and waits when history is unknown", async () => {
    const withdrawal = created(CC_TEMPLATE_IDS.CcWithdrawal, "wd1", {
      venue: VENUE, owner: ALICE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, units: "200000", sentAtomic: "20000000000",
      state: "WdSent", instructionCid: "gone1", openedAt: "2026-10-01T11:00:00Z", ref: "w",
    });
    const accepted = harness({ templates: [LISTING, ACCOUNT, withdrawal], views: [] });
    const a = await railPass(deps(accepted, registry(), { history: async (cids) => new Map(cids.map((c) => [c, "accepted" as const])) }));
    expect(a.completed).toBe(1);
    resetRailClock();
    const unknown = harness({ templates: [LISTING, ACCOUNT, withdrawal], views: [] });
    const u = await railPass(deps(unknown, registry()));
    expect(u.completed + u.refunded).toBe(0);
  });

  it("does nothing that needs a registry when none is configured, and survives a failed command", async () => {
    const h = harness({
      templates: [LISTING, ACCOUNT],
      views: [withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "instr1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "12.5000000000") }], { signatories: [ALICE, ADMIN] })],
    });
    const none = await railPass(deps(h, null));
    expect(none.settled).toBe(0);
    const failing = harness({
      templates: [LISTING, ACCOUNT],
      views: [withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "instr1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "12.5000000000") }], { signatories: [ALICE, ADMIN] })],
      failSubmit: (c) => choiceOf(c) === "Listing_SettleDeposit",
    });
    resetRailClock();
    const r = await railPass(deps(failing, registry()));
    expect(r.settled).toBe(0);
    expect(r.failures[0]).toContain("settle instr1");
  });

  it("says so when the venue has no listing", async () => {
    const log = vi.fn();
    const h = harness({ templates: [], views: [] });
    const r = await railPass(deps(h, registry(), { log }));
    expect(r.settled).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("no listing"));
  });
});

describe("the reserve statement's clock (revamp 2b)", () => {
  const statement = (heldAtomic: string) =>
    created(CC_TEMPLATE_IDS.CcReserveStatement, `stmt-${heldAtomic}`, {
      venue: VENUE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: RATE, seq: "0", "asOf": "2026-10-01T11:59:00Z",
      heldAtomic, heldUnits: "0", liabilityAtomic: "0", liabilityUnits: "0", allowanceCount: "0", covered: true, previous: null,
    });
  const deposit = () => withViews("pkg:Splice.Amulet:AmuletTransferInstruction", "instr1", [{ interfaceId: CIP56_INTERFACE_IDS.TransferInstruction, viewValue: instrView(ALICE, VENUE, "12.5000000000") }], { signatories: [ALICE, ADMIN] });
  const venueCoin = () => withViews("pkg:Splice.Amulet:Amulet", "hold1", [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: holdingView(VENUE, "12.5000000000") }], { signatories: [VENUE, ADMIN] });
  const at = (sec: number) => () => Date.parse("2026-10-01T12:00:00Z") / 1000 + sec;
  const pass = (h: ReturnType<typeof harness>, sec: number) => railPass(deps(h, registry(), { attestEverySec: 300, nowSec: at(sec) }));

  it("states a move made before the statement was due at the next due pass, even when that pass moves nothing", async () => {
    const templates: ActiveContract[] = [LISTING, ACCOUNT, statement("0")];
    const views: ActiveContract[] = [deposit()];
    const h = harness({ templates, views });
    expect(await pass(h, 0)).toMatchObject({ settled: 1, attested: true });
    // a minute later the coin has moved, but the statement is not due
    views.splice(0, views.length, venueCoin());
    expect(await pass(h, 60)).toMatchObject({ attested: false });
    // nothing moves after that; once due, the statement no longer says what is held, so it is stated again
    expect(await pass(h, 301)).toMatchObject({ settled: 0, attested: true });
    // once the ledger's statement says what is held, a quiet due pass states nothing more
    templates.splice(2, 1, statement("125000000000"));
    expect(await pass(h, 700)).toMatchObject({ attested: false });
  });

  it("after a restart, re-states a statement the ledger has moved past", async () => {
    const h = harness({ templates: [LISTING, ACCOUNT, statement("0")], views: [venueCoin()] });
    resetRailClock();
    expect(await pass(h, 0)).toMatchObject({ settled: 0, attested: true });
  });
});
