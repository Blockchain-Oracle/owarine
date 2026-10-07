import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import type { Command, DisclosedContract, LedgerClient, Party } from "@owarine/ledger";
import { describe, expect, it } from "vitest";
import { createRegistryClient, pickOpenRound, scanContract, tapCommand, type RegistryClient, type TapContext } from "../ops/cc";
import { createCcSeat } from "./cc";
import type { CcFaucet } from "./cc-moves";
import type { CommandJournal, CommandRow } from "./writes";

const VENUE = "venue::1220aa" as Party;
const A = "seat-1::1220bb" as Party;
const STRANGER = "other::1220ee" as Party;
const ADMIN = "DSO::1220dd";
const SEAT = { party: A, leaseId: "lease-a", address: "SeatA111", fromOffset: 100 };
const J1 = "0b8f3f0e-6a55-4d7f-9a3b-1f7f3c3c0001";
const UPDATE = `1220${"ab".repeat(32)}`;
const suffix = (t: string) => t.slice(t.indexOf(":"));

interface Row { cid: string; templateId: string; data: Record<string, unknown>; seenBy: Party[]; offset: number; signatories: string[]; views?: { interfaceId: string; viewValue: unknown }[] }

const listingRow: Row = {
  cid: "listing", templateId: CC_TEMPLATE_IDS.CcListing, seenBy: [VENUE], offset: 1, signatories: [VENUE],
  data: { venue: VENUE, auditor: "aud::1", listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "125000", minDepositUnits: "100000", maxDepositUnits: "1000000000", depositsOpen: true },
};
const holding = (cid: string, amount: string): Row => ({
  cid, templateId: "pkg:Splice.Amulet:Amulet", seenBy: [A], offset: 1, signatories: [ADMIN, A], data: {},
  views: [{ interfaceId: CIP56_INTERFACE_IDS.Holding, viewValue: { owner: A, instrumentId: { admin: ADMIN, id: "Amulet" }, amount, lock: null, meta: { values: {} } } }],
});
const sentReceipt = (ref: string): Row => ({
  cid: `wd-${ref}`, templateId: CC_TEMPLATE_IDS.CcWithdrawal, seenBy: [VENUE, A], offset: 200, signatories: [VENUE],
  data: { venue: VENUE, auditor: "aud::1", owner: A, listingId: "cc-1", instrumentAdmin: ADMIN, instrumentId: "Amulet", unitsPerCoin: "125000", units: "5000000", sentAtomic: "400000000000", state: "WdSent", instructionCid: `ti-${ref}`, openedAt: "2026-10-07T20:29:47Z", ref },
});
const instruction = (cid: string, o: { sender?: string; ref?: string; signatories?: string[]; status?: string } = {}): Row => ({
  cid, templateId: "pkg:Splice.AmuletTransferInstruction:AmuletTransferInstruction", seenBy: [A], offset: 210, signatories: o.signatories ?? [ADMIN, o.sender ?? VENUE],
  data: {},
  views: [{
    interfaceId: CIP56_INTERFACE_IDS.TransferInstruction,
    viewValue: {
      originalInstructionCid: null,
      transfer: {
        sender: o.sender ?? VENUE, receiver: A, amount: "40.0000000000", instrumentId: { admin: ADMIN, id: "Amulet" },
        requestedAt: "2026-10-07T20:29:00Z", executeBefore: "2026-10-08T20:29:00Z", inputHoldingCids: [], meta: { values: o.ref === undefined ? {} : { "abu-pm.io/ref": o.ref } },
      },
      status: { tag: o.status ?? "TransferPendingReceiverAcceptance", value: {} },
      meta: { values: {} },
    },
  }],
});

function ledger(rows: Row[]) {
  const sent: { actAs: Party[]; commandId: string; commands: Command[]; disclosedContracts?: DisclosedContract[] }[] = [];
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
    submitAndWaitForTransaction: async (req: (typeof sent)[number]) => {
      sent.push(req);
      return { transaction: { updateId: UPDATE, events: [] }, recovered: false };
    },
    findAcceptedCompletion: async () => null,
  } as unknown as LedgerClient;
  return { client, sent };
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

const disclosed = (cid: string): DisclosedContract => ({ templateId: "p:Splice.AmuletRules:AmuletRules", contractId: cid as DisclosedContract["contractId"], createdEventBlob: "blob", synchronizerId: "global" });
const TAP: TapContext = {
  dsoParty: ADMIN as Party,
  amuletRules: { contractId: "00rules" as TapContext["amuletRules"]["contractId"], templateId: "p:Splice.AmuletRules:AmuletRules", disclosed: disclosed("00rules"), payload: {} },
  openRound: { contractId: "00round" as TapContext["openRound"]["contractId"], templateId: "p:Splice.Round:OpenMiningRound", disclosed: disclosed("00round"), payload: {} },
};
const faucet = (ctx: TapContext = TAP): CcFaucet => ({ amount: "200", capAtomic: 2_000_000_000_000n, context: async () => ctx });
const REG_CTX = { choiceContextData: { values: { k: 1 } }, disclosedContracts: [disclosed("00ctx")] };
const registry = (): RegistryClient & { asked: string[] } => {
  const asked: string[] = [];
  return { asked, transferFactory: async () => ({ factoryId: "00f", transferKind: "offer", context: REG_CTX }), instructionContext: async (choice, cid) => (asked.push(`${choice}:${cid}`), REG_CTX) };
};

const seatOf = (rows: Row[], o: { capability?: "live" | "not-live"; faucet?: CcFaucet | null; registry?: RegistryClient | null } = {}) => {
  const l = ledger([listingRow, { cid: "acct", templateId: TEMPLATE_IDS.VenueAccount, seenBy: [VENUE, A], offset: 2, signatories: [VENUE, A], data: {} }, ...rows]);
  const cc = createCcSeat({ client: l.client, venueParty: VENUE, journal: memoryJournal(), listingId: "cc-1", capability: o.capability ?? "live", registry: o.registry ?? null, faucet: o.faucet ?? null, now: () => 1_791_404_000_000 });
  return { ...l, cc };
};

describe("the DevNet faucet (revamp 2b)", () => {
  it("offers the faucet's amount below the cap and taps it as the seat alone, with the DSO's rules and round disclosed", async () => {
    const s = seatOf([holding("h1", "50.0000000000")], { faucet: faucet() });
    expect((await s.cc.status(SEAT)).faucetCoin).toBe("200");
    expect(await s.cc.requestTap(SEAT, { journalId: J1 })).toMatchObject({ kind: "requested", recovered: false });
    const [sub] = s.sent;
    expect(sub!.actAs).toEqual([A]);
    expect(sub!.commandId).toBe(`cctap:${J1}`);
    expect(sub!.commands).toEqual([{ ExerciseCommand: { templateId: TAP.amuletRules.templateId, contractId: "00rules", choice: "AmuletRules_DevNet_Tap", choiceArgument: { receiver: A, amount: "200", openRound: "00round" } } }]);
    expect(sub!.disclosedContracts?.map((d) => d.contractId)).toEqual(["00rules", "00round"]);
  });

  it("offers nothing and refuses once the seat holds the cap, without a faucet, or while not live", async () => {
    const full = seatOf([holding("h1", "200.0000000000")], { faucet: faucet() });
    expect((await full.cc.status(SEAT)).faucetCoin).toBeNull();
    expect(await full.cc.requestTap(SEAT, { journalId: J1 })).toMatchObject({ kind: "refused", diagnosis: { kind: "grant-refused" } });
    expect(await seatOf([]).cc.requestTap(SEAT, { journalId: J1 })).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
    expect(await seatOf([], { capability: "not-live", faucet: faucet() }).cc.requestTap(SEAT, { journalId: J1 })).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
    for (const s of [full]) expect(s.sent).toHaveLength(0);
  });

  it("refuses when the network's coin is not the coin the venue lists", async () => {
    const s = seatOf([], { faucet: faucet({ ...TAP, dsoParty: "DSO::other" as Party }) });
    expect(await s.cc.requestTap(SEAT, { journalId: J1 })).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
    expect(s.sent).toHaveLength(0);
  });
});

describe("receiving a withdrawal (revamp 2b)", () => {
  it("accepts the venue's registry-signed transfer for the seat's own sent receipt, with the registry's accept context", async () => {
    const reg = registry();
    const s = seatOf([sentReceipt("r1"), instruction("ti-r1", { ref: "r1" })], { registry: reg });
    expect(await s.cc.requestReceive(SEAT, { journalId: J1 })).toMatchObject({ kind: "requested" });
    expect(reg.asked).toEqual(["accept:ti-r1"]);
    const [sub] = s.sent;
    expect(sub!.actAs).toEqual([A]);
    expect(sub!.commandId).toBe(`ccreceive:${J1}`);
    expect(sub!.commands).toEqual([{ ExerciseCommand: { templateId: CIP56_INTERFACE_IDS.TransferInstruction, contractId: "ti-r1", choice: "TransferInstruction_Accept", choiceArgument: { extraArgs: { context: REG_CTX.choiceContextData, meta: { values: {} } } } } }]);
    expect(sub!.disclosedContracts?.map((d) => d.contractId)).toEqual(["00ctx"]);
  });

  it("never accepts a stranger's offer, a look-alike the registry did not sign, one naming no receipt of the seat's, or one already settled", async () => {
    const reg = registry();
    const s = seatOf(
      [
        sentReceipt("r1"),
        instruction("ti-stranger", { sender: STRANGER, ref: "r1" }),
        instruction("ti-fake", { ref: "r1", signatories: [VENUE] }),
        instruction("ti-other-ref", { ref: "r9" }),
        instruction("ti-no-ref"),
        instruction("ti-internal", { ref: "r1", status: "TransferPendingInternalWorkflow" }),
      ],
      { registry: reg },
    );
    expect(await s.cc.requestReceive(SEAT, { journalId: J1 })).toMatchObject({ kind: "refused", diagnosis: { kind: "grant-refused" } });
    expect(reg.asked).toEqual([]);
    expect(s.sent).toHaveLength(0);
  });

  it("refuses without a registry", async () => {
    expect(await seatOf([sentReceipt("r1"), instruction("ti-r1", { ref: "r1" })]).cc.requestReceive(SEAT, { journalId: J1 })).toMatchObject({ kind: "refused", diagnosis: { kind: "not-deployed" } });
  });
});

describe("the scan proxy's coin rules", () => {
  const round = (opensAt: string, closes: string, cid: string) => ({ contract: { contract_id: cid, template_id: "p:Splice.Round:OpenMiningRound", created_event_blob: "b", payload: { opensAt, targetClosesAt: closes } }, domain_id: "global" });
  it("taps in the open round furthest from closing, never one not open yet or already closing", () => {
    const now = Date.parse("2026-10-07T20:20:00Z");
    const rounds = [round("2026-10-07T20:06:00Z", "2026-10-07T20:26:00Z", "r1"), round("2026-10-07T20:16:00Z", "2026-10-07T20:36:00Z", "r2"), round("2026-10-07T20:26:00Z", "2026-10-07T20:46:00Z", "r3")];
    expect(pickOpenRound(rounds, now)?.contract?.contract_id).toBe("r2");
    expect(pickOpenRound(rounds, Date.parse("2026-10-07T21:00:00Z"))).toBeNull();
  });
  it("refuses an incomplete record and a bad amount", () => {
    expect(() => scanContract({ contract: { contract_id: "x" } }, "AmuletRules")).toThrow("incomplete");
    for (const bad of ["0", "-1", "1e3", "1.12345678901"]) expect(() => tapCommand(TAP, A, bad)).toThrow();
  });
});

describe("the registry behind a scan proxy", () => {
  it("sends the ledger token only when configured, and only to the configured base", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const fetchImpl = (async (url: string, init: { headers: Record<string, string> }) => {
      seen.push({ url, auth: init.headers.authorization ?? null });
      return new Response(JSON.stringify(REG_CTX), { status: 200 });
    }) as unknown as typeof fetch;
    const base = "https://validator.example/api/validator/v0/scan-proxy";
    await createRegistryClient({ baseUrl: base, fetch: fetchImpl, token: async () => "tok" }).instructionContext("accept", "ti-1");
    await createRegistryClient({ baseUrl: base, fetch: fetchImpl }).instructionContext("accept", "ti-1");
    expect(seen).toEqual([
      { url: `${base}/registry/transfer-instruction/v1/ti-1/choice-contexts/accept`, auth: "Bearer tok" },
      { url: `${base}/registry/transfer-instruction/v1/ti-1/choice-contexts/accept`, auth: null },
    ]);
  });
});
