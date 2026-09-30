import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { Command, LedgerClient, Party } from "@agari/ledger";
import { describe, expect, it } from "vitest";
import { RegistryError, type RegistryClient } from "../ops/cc";
import { createCcSeat } from "./cc";
import type { CommandJournal, CommandRow } from "./writes";

const VENUE = "venue::1220aa" as Party;
const A = "seat-1::1220bb" as Party;
const B = "seat-2::1220cc" as Party;
const ADMIN = "dso::1220dd";
const SEAT = { party: A, leaseId: "lease-a", address: "SeatA111", fromOffset: 100 };
const J1 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0001";
const J2 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0002";
const UPDATE = `1220${"ab".repeat(32)}`;
const suffix = (t: string) => t.slice(t.indexOf(":"));

interface Row { cid: string; templateId: string; data: Record<string, unknown>; seenBy: Party[]; offset: number; signatories: string[]; views?: { interfaceId: string; viewValue: unknown }[] }

const listing = { venue: VENUE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "100000", minDepositUnits: "100000", maxDepositUnits: "1000000000", depositsOpen: true };
const allowance = (cid: string, owner: Party, units: string, offset: number, signatories: string[] = [VENUE]): Row => ({
  cid, templateId: CC_TEMPLATE_IDS.CcAllowance, seenBy: [VENUE, owner], offset, signatories,
  data: { venue: VENUE, auditor: "aud::1", owner, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "100000", units },
});
const cash = (cid: string, owner: Party, amount: string, offset = 5): Row => ({ cid, templateId: TEMPLATE_IDS.VenueCash, seenBy: [VENUE, owner], offset, signatories: [VENUE, owner], data: { venue: VENUE, owner, amount, bucket: "cc:cc-1" } });
const proposal = (cid: string, owner: Party, units: string, offset: number): Row => ({
  cid, templateId: CC_TEMPLATE_IDS.CcWithdrawProposal, seenBy: [VENUE, owner], offset, signatories: [owner],
  data: { owner, venue: VENUE, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "100000", units, "validUntil": "2026-10-01T13:00:00Z", ref: "r" },
});
const account = (owner: Party): Row => ({ cid: `acct-${owner}`, templateId: TEMPLATE_IDS.VenueAccount, seenBy: [VENUE, owner], offset: 2, signatories: [VENUE, owner], data: { venue: VENUE, owner, label: "x" } });
const holding = (cid: string, seenBy: Party[], owner: string, amount: string, lock: unknown = null, signatories: string[] = [ADMIN, owner]): Row => ({
  cid, templateId: "pkg:Splice.Amulet:Amulet", seenBy, offset: 1, signatories, data: {}, views: [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: { owner, instrumentId: { admin: ADMIN, id: "Amulet" }, amount, lock, meta: { values: {} } } }],
});
const listingRow: Row = { cid: "listing", templateId: CC_TEMPLATE_IDS.CcListing, seenBy: [VENUE], offset: 1, signatories: [VENUE], data: listing };

function ledger(initial: Row[]) {
  const rows = [...initial];
  const sent: { actAs: Party[]; commandId: string; commands: Command[] }[] = [];
  const client = {
    activeContracts: async (req: { parties: Party[]; templateIds?: string[]; interfaceIds?: string[] }) => {
      const wantT = new Set((req.templateIds ?? []).map(suffix));
      const wantI = new Set((req.interfaceIds ?? []).map(suffix));
      return {
        activeAtOffset: 99,
        contracts: rows
          .filter((r) => r.seenBy.some((p) => req.parties.includes(p)) && (req.interfaceIds ? r.views && wantI.has(suffix(r.views[0]!.interfaceId)) : wantT.has(suffix(r.templateId))))
          .map((r) => ({ synchronizerId: "s", createdEvent: { contractId: r.cid, templateId: r.templateId, createArgument: r.data, offset: r.offset, signatories: r.signatories, ...(r.views ? { interfaceViews: r.views.map((v) => ({ ...v, viewStatus: { code: 0 } })) } : {}) } })),
      };
    },
    ledgerEnd: async () => 500,
    submitAndWaitForTransaction: async (req: { actAs: Party[]; commandId: string; commands: Command[] }) => {
      sent.push(req);
      return { transaction: { updateId: UPDATE, events: [] }, recovered: false };
    },
    findAcceptedCompletion: async () => null,
  } as unknown as LedgerClient;
  return { client, sent };
}

function memoryJournal() {
  const rows = new Map<string, CommandRow>();
  const journal: CommandJournal = {
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
  return { journal, rows };
}

const CTX = { choiceContextData: { values: {} }, disclosedContracts: [{ templateId: "p:M:T", contractId: "00c", createdEventBlob: "b", synchronizerId: "s" }] };
const registryOf = (fail = false): RegistryClient & { asked: unknown[] } => {
  const asked: unknown[] = [];
  return {
    asked,
    transferFactory: async (args) => {
      asked.push(args);
      if (fail) throw new RegistryError("down");
      return { factoryId: "00factory", transferKind: "offer", context: CTX };
    },
    instructionContext: async () => CTX,
  };
};

const coin0 = () => holding("h0", [A], A, "50.0000000000");

const seatOf = (rows: Row[], capability: "not-live" | "live", registry: RegistryClient | null = null) => {
  const l = ledger(rows);
  const j = memoryJournal();
  return { ...l, ...j, cc: createCcSeat({ client: l.client, venueParty: VENUE, journal: j.journal, listingId: "cc-1", capability, registry, now: () => 1_000_000_000 }) };
};

describe("the seat's Canton Coin path (C7b)", () => {
  it("says the path is not live and why, while the capability is not-live, and still reads truthfully", async () => {
    const { cc } = seatOf([listingRow, allowance("al", A, "500000", 150), cash("c1", A, "500000")], "not-live");
    const v = await cc.status(SEAT);
    expect(v.capability).toBe("not-live");
    expect(v.reason).toMatch(/not live: waiting on a DevNet run/);
    expect(v.listing).toMatchObject({ listingId: "cc-1", unitsPerCoin: "100000" });
    expect(v.allowanceUnits).toBe("500000");
    expect(v.cashUnits).toBe("500000");
  });

  it("refuses every write before journaling or signing while not-live", async () => {
    const { cc, sent, rows } = seatOf([listingRow, allowance("al", A, "500000", 150), cash("c1", A, "500000")], "not-live");
    const r = await cc.requestWithdraw(SEAT, { journalId: J1, units: 100_000n });
    expect(r).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
    expect(sent).toHaveLength(0);
    expect(rows.size).toBe(0);
  });

  it("counts only this lease's records (K-224), the party's cash, and the seat's own unlocked and locked coin", async () => {
    const { cc } = seatOf(
      [
        listingRow,
        allowance("old", A, "900000", 50), allowance("mine", A, "300000", 150), allowance("bobs", B, "777", 150),
        cash("c1", A, "1000000", 5), cash("c2", B, "42", 5),
        proposal("p-old", A, "5", 60), proposal("p-new", A, "6", 170),
        holding("h1", [A], A, "3.5000000000"), holding("h2", [A], A, "1.0000000000", { holders: [A], expiresAt: null, expiresAfter: null, context: null }),
        holding("offer", [A], "someone-else::1", "99.0000000000", { holders: ["x"], expiresAt: null, expiresAfter: null, context: null }),
        holding("bobs-coin", [B], B, "8.0000000000"),
      ],
      "live",
    );
    const v = await cc.status(SEAT);
    expect(v.allowanceUnits).toBe("300000");
    expect(v.cashUnits).toBe("1000000");
    expect(v.proposals).toEqual([{ units: "6", ref: "r" }]);
    expect(v.holdings).toEqual([{ instrumentAdmin: ADMIN, instrumentId: "Amulet", unlockedAtomic: "35000000000", lockedAtomic: "10000000000" }]);
    expect(v.reason).toBeNull();
  });

  it("ignores look-alike records a stranger made naming the seat or the venue as an observer: only what the venue signed counts", async () => {
    const { cc } = seatOf(
      [
        listingRow, allowance("real", A, "300000", 150), allowance("fake", A, "999999999", 160, ["attacker::1"]),
        cash("c1", A, "1000000"), { ...cash("c2", A, "777777777"), signatories: ["attacker::1", A] },
        holding("h1", [A], A, "1.0000000000"), holding("fake-coin", [A], A, "9999.0000000000", null, [A, "attacker::1"]),
        { ...listingRow, cid: "fake-listing", data: { ...listing, unitsPerCoin: "1000000" }, signatories: ["attacker::1"] },
        { cid: "fake-stmt", templateId: CC_TEMPLATE_IDS.CcReserveStatement, seenBy: [VENUE], offset: 1, signatories: ["attacker::1"], data: { venue: "attacker::1", auditor: VENUE, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "100000", seq: "999", asOf: "2026-10-01T12:00:00Z", heldAtomic: "1", heldUnits: "1", liabilityAtomic: "0", liabilityUnits: "0", allowanceCount: "0", covered: true } },
      ],
      "live",
    );
    const v = await cc.status(SEAT);
    expect(v.allowanceUnits).toBe("300000");
    expect(v.cashUnits).toBe("1000000");
    expect(v.holdings).toEqual([{ instrumentAdmin: ADMIN, instrumentId: "Amulet", unlockedAtomic: "10000000000", lockedAtomic: "0" }]);
    expect(v.listing?.unitsPerCoin).toBe("100000");
    expect(v.reserve).toBeNull();
  });

  it("reports an unlisted or closed venue as the reason, not as a working path", async () => {
    const none = await seatOf([], "live").cc.status(SEAT);
    expect(none.listing).toBeNull();
    expect(none.reason).toBe("The venue has not listed Canton Coin yet.");
    const closed = await seatOf([{ ...listingRow, data: { ...listing, depositsOpen: false } }], "live").cc.status(SEAT);
    expect(closed.reason).toBe("The venue is not taking new Canton Coin deposits.");
  });

  it("asks for a withdrawal as the seat only, with the amount, the terms it saw, an expiry and the client's reference", async () => {
    const { cc, sent, rows } = seatOf([listingRow, allowance("al", A, "500000", 150), cash("c1", A, "500000")], "live");
    const r = await cc.requestWithdraw(SEAT, { journalId: J1, units: 200_000n });
    expect(r).toMatchObject({ kind: "requested", recovered: false });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.actAs).toEqual([A]);
    const c = sent[0]?.commands[0] as { CreateCommand: { templateId: string; createArguments: Record<string, unknown> } };
    expect(c.CreateCommand.templateId).toBe(CC_TEMPLATE_IDS.CcWithdrawProposal);
    expect(c.CreateCommand.createArguments).toEqual({
      owner: A, venue: VENUE, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "100000", units: "200000",
      validUntil: new Date(1_000_000_000 + 3_600_000).toISOString().replace(".000Z", "Z"), ref: J1,
    });
    expect(rows.get(sent[0]!.commandId)?.state).toBe("landed");
  });

  it("refuses what the ledger would refuse, before signing", async () => {
    const base = [listingRow, allowance("al", A, "500000", 150), cash("c1", A, "500000")];
    const over = await seatOf(base, "live").cc.requestWithdraw(SEAT, { journalId: J1, units: 500_001n });
    expect(over).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
    const noCash = await seatOf([listingRow, allowance("al", A, "500000", 150), cash("c1", A, "10")], "live").cc.requestWithdraw(SEAT, { journalId: J1, units: 100n });
    expect(noCash).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
    const zero = await seatOf(base, "live").cc.requestWithdraw(SEAT, { journalId: J1, units: 0n });
    expect(zero).toMatchObject({ kind: "refused", diagnosis: { kind: "invalid-price" } });
    const waiting = seatOf([...base, proposal("p", A, "1", 170)], "live");
    expect(await waiting.cc.requestWithdraw(SEAT, { journalId: J2, units: 1n })).toMatchObject({ kind: "refused" });
    expect(waiting.sent).toHaveLength(0);
    const unlisted = await seatOf([allowance("al", A, "500000", 150), cash("c1", A, "500000")], "live").cc.requestWithdraw(SEAT, { journalId: J1, units: 1n });
    expect(unlisted).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
  });

  it("does not spend an earlier visitor's allowance on the same party", async () => {
    const r = await seatOf([listingRow, allowance("old", A, "500000", 50), cash("c1", A, "500000")], "live").cc.requestWithdraw(SEAT, { journalId: J1, units: 1n });
    expect(r).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
  });

  it("does not answer a UUID first used for a withdrawal as if it had been a deposit, or the reverse", async () => {
    const t = seatOf([listingRow, coin0(), account(A), allowance("al", A, "500000", 150), cash("c1", A, "500000")], "live", registryOf());
    await t.cc.requestWithdraw(SEAT, { journalId: J1, units: 1n });
    const asDeposit = await t.cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" });
    expect(asDeposit).toMatchObject({ kind: "requested", recovered: false });
    expect(t.sent).toHaveLength(2);
    expect(new Set(t.sent.map((x) => x.commandId)).size).toBe(2);
  });

  it("answers a retry of a request that landed with its original transaction, and refuses another seat's command id", async () => {
    const t = seatOf([listingRow, allowance("al", A, "500000", 150), cash("c1", A, "500000")], "live");
    await t.cc.requestWithdraw(SEAT, { journalId: J1, units: 1n });
    const again = await t.cc.requestWithdraw(SEAT, { journalId: J1, units: 1n });
    expect(again).toMatchObject({ kind: "requested", recovered: true, updateId: UPDATE });
    expect(t.sent).toHaveLength(1);
    const other = await t.cc.requestWithdraw({ ...SEAT, party: B, leaseId: "lease-b" }, { journalId: J1, units: 1n });
    expect(other).toMatchObject({ kind: "refused" });
  });
});

describe("the seat's deposit instruction (C7b)", () => {
  const coin = holding("h1", [A], A, "50.0000000000");
  const live = (rows: Row[] = [listingRow, coin, account(A)], reg: RegistryClient | null = registryOf()) => seatOf(rows, "live", reg);

  it("refuses while not-live, before asking the registry or signing", async () => {
    const reg = registryOf();
    const t = seatOf([listingRow, coin], "not-live", reg);
    expect(await t.cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
    expect(reg.asked).toHaveLength(0);
    expect(t.sent).toHaveLength(0);
  });

  it("instructs the token-standard transfer as the seat only, with the registry's context and exact amounts", async () => {
    const reg = registryOf();
    const t = live([listingRow, coin, account(A)], reg);
    const r = await t.cc.requestDeposit(SEAT, { journalId: J1, amount: "12.5" });
    expect(r).toMatchObject({ kind: "requested", recovered: false });
    const asked = reg.asked[0] as { expectedAdmin: string; transfer: { sender: string; receiver: string; amount: string; inputHoldingCids: string[]; meta: { values: Record<string, string> } } };
    expect(asked.expectedAdmin).toBe(ADMIN);
    expect(asked.transfer).toMatchObject({ sender: A, receiver: VENUE, amount: "12.5000000000", inputHoldingCids: ["h1"] });
    expect(asked.transfer.meta.values["abu-pm.io/ref"]).toBe(J1);
    expect(t.sent[0]?.actAs).toEqual([A]);
    const cmd = t.sent[0]?.commands[0] as { ExerciseCommand: { templateId: string; contractId: string; choice: string } };
    expect(cmd.ExerciseCommand).toMatchObject({ templateId: CIP56_INTERFACE_IDS.TransferFactory, contractId: "00factory", choice: "TransferFactory_Transfer" });
    expect((t.sent[0] as unknown as { disclosedContracts: unknown }).disclosedContracts).toEqual(CTX.disclosedContracts);
  });

  it("refuses dust and out-of-bounds amounts before signing: they would only be sent back", async () => {
    const t = live();
    expect(await t.cc.requestDeposit(SEAT, { journalId: J1, amount: "1.000001" })).toMatchObject({ kind: "refused", diagnosis: { kind: "invalid-price" } });
    expect(await t.cc.requestDeposit(SEAT, { journalId: J2, amount: "0.5" })).toMatchObject({ kind: "refused", diagnosis: { kind: "invalid-price" } });
    expect(t.sent).toHaveLength(0);
  });

  it("refuses without a registry, without enough unlocked coin, and when the registry is down", async () => {
    expect(await live([listingRow, coin, account(A)], null).cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
    expect(await live([listingRow, coin, account(A)]).cc.requestDeposit(SEAT, { journalId: J1, amount: "60.0" })).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
    const locked = holding("h2", [A], A, "50.0000000000", { holders: [A], expiresAt: null, expiresAfter: null, context: null });
    expect(await live([listingRow, locked, account(A)]).cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
    const down = live([listingRow, coin, account(A)], registryOf(true));
    expect(await down.cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused" });
    expect(down.sent).toHaveLength(0);
  });

  it("refuses a deposit for a seat with no venue account: the credit would have nowhere to go", async () => {
    const reg = registryOf();
    const t = seatOf([listingRow, holding("h1", [A], A, "50.0000000000")], "live", reg);
    expect(await t.cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused" });
    expect(reg.asked).toHaveLength(0);
    expect(t.sent).toHaveLength(0);
  });

  it("does not spend a look-alike coin a stranger made: only coin the registry signed funds a deposit", async () => {
    const t = seatOf([listingRow, account(A), holding("fake", [A], A, "50.0000000000", null, [A, "attacker::1"])], "live", registryOf());
    expect(await t.cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused", diagnosis: { kind: "insufficient-collateral" } });
  });

  it("refuses a closed listing", async () => {
    const closed = { ...listingRow, data: { ...listing, depositsOpen: false } };
    expect(await live([closed, coin, account(A)]).cc.requestDeposit(SEAT, { journalId: J1, amount: "1.0" })).toMatchObject({ kind: "refused" });
  });
});
