/**
 * The Canton Coin rail's venue-side pass (C7b): read what the venue can see, plan with `policy.ts`, execute the plan.
 * The order matters: what is already in flight is settled first (a refund frees allowance and cash), then deposits (they
 * raise the allowance a withdrawal needs), then withdrawals, then the reserve statement. Every command has a stable id
 * (`ids.ts`), so a crash between reading and executing repeats nothing.
 *
 * Nothing here contacts a node in a test: the session's client and the registry client are injected. It is built from the
 * JSON Ledger API and registry API specifications and has not run against a participant (`docs/evidence/c7b-canton-coin.md`).
 */
import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { ContractId, DisclosedContract, Party } from "@agari/ledger";
import { decodeVenueAccount, decodeVenueCash } from "../canton/decode";
import { failureText, pick, submit, type RoleSession } from "../canton/session";
import * as cmd from "./commands";
import {
  decodeAllowance, decodeHoldingView, decodeListing, decodeProposal, decodeStatement, decodeTransferInstructionView, decodeWithdrawal, interfaceViewOf,
  type AllowanceC, type ListingC, type ProposalC, type StatementC, type WithdrawalC,
} from "./decode";
import * as ids from "./ids";
import {
  planAttest, planDeposits, unlockedHoldings, planInFlight, planWithdrawals, type CashRow, type HoldingRow, type InstructionRow, type LeaseOf, type Row,
} from "./policy";
import type { RegistryClient } from "./registry";

export interface RailSnapshot {
  listing: Row<ListingC> | null;
  allowances: Row<AllowanceC>[];
  proposals: (Row<ProposalC> & { createdOffset: number })[];
  withdrawals: (Row<WithdrawalC> & { createdOffset: number })[];
  statement: Row<StatementC> | null;
  /** owner → VenueAccount cid. */
  accounts: Map<Party, ContractId>;
  cash: CashRow[];
  /** Transfer instructions the venue is the receiver of. */
  incoming: InstructionRow[];
  /** Transfer instructions the venue sent, by cid. */
  outgoing: Map<ContractId, { executeBeforeSec: number }>;
  /** The venue's own holdings of any instrument (the plans filter to the listed one). */
  holdings: HoldingRow[];
}

const RAIL_TEMPLATES = [
  CC_TEMPLATE_IDS.CcListing, CC_TEMPLATE_IDS.CcAllowance, CC_TEMPLATE_IDS.CcWithdrawProposal, CC_TEMPLATE_IDS.CcWithdrawal, CC_TEMPLATE_IDS.CcReserveStatement,
  TEMPLATE_IDS.VenueAccount, TEMPLATE_IDS.VenueCash,
] as const;

/** Read the rail's state as the venue sees it: two paged snapshots (templates, then the CIP-56 interfaces). */
export async function readRail(venue: RoleSession, listingId: string): Promise<RailSnapshot> {
  const me = venue.party;
  const acs = (await venue.client.activeContracts({ parties: [me], templateIds: [...RAIL_TEMPLATES], maxPageSize: 500 })).contracts;
  const views = (
    await venue.client.activeContracts({ parties: [me], interfaceIds: [CIP56_INTERFACE_IDS.Holding, CIP56_INTERFACE_IDS.TransferInstruction], maxPageSize: 500 })
  ).contracts;

  const listings = pick(acs, CC_TEMPLATE_IDS.CcListing, decodeListing).filter((l) => l.data.venue === me && l.data.listingId === listingId);
  const statements = pick(acs, CC_TEMPLATE_IDS.CcReserveStatement, decodeStatement).filter((s) => s.data.listingId === listingId);
  const proposalEvents = new Map(acs.map((c) => [c.createdEvent.contractId, c.createdEvent.offset]));
  const accounts = new Map<Party, ContractId>();
  for (const a of pick(acs, TEMPLATE_IDS.VenueAccount, decodeVenueAccount)) if (a.data.venue === me) accounts.set(a.data.owner, a.cid);

  const incoming: InstructionRow[] = [];
  const outgoing = new Map<ContractId, { executeBeforeSec: number }>();
  const holdings: HoldingRow[] = [];
  for (const c of views) {
    const e = c.createdEvent;
    const instrView = interfaceViewOf(e, CIP56_INTERFACE_IDS.TransferInstruction);
    if (instrView) {
      try {
        const v = decodeTransferInstructionView(instrView);
        if (v.receiver === me) incoming.push({ cid: e.contractId, templateId: e.templateId, signatories: e.signatories, createdOffset: e.offset, view: v });
        else if (v.sender === me) outgoing.set(e.contractId, { executeBeforeSec: v.executeBeforeSec });
      } catch {
        /* a view this build cannot read is not the rail's */
      }
    }
    const holdView = interfaceViewOf(e, CIP56_INTERFACE_IDS.Holding);
    if (holdView) {
      try {
        const v = decodeHoldingView(holdView);
        if (v.owner === me) holdings.push({ cid: e.contractId, view: v });
      } catch {
        /* likewise */
      }
    }
  }
  return {
    listing: listings[0] ?? null,
    allowances: pick(acs, CC_TEMPLATE_IDS.CcAllowance, decodeAllowance).filter((a) => a.data.venue === me && a.data.listingId === listingId),
    proposals: pick(acs, CC_TEMPLATE_IDS.CcWithdrawProposal, decodeProposal)
      .filter((p) => p.data.venue === me && p.data.listingId === listingId)
      .map((p) => ({ ...p, createdOffset: proposalEvents.get(p.cid) ?? 0 })),
    withdrawals: pick(acs, CC_TEMPLATE_IDS.CcWithdrawal, decodeWithdrawal)
      .filter((w) => w.data.venue === me && w.data.listingId === listingId)
      .map((w) => ({ ...w, createdOffset: proposalEvents.get(w.cid) ?? 0 })),
    statement: statements.sort((a, b) => b.data.seq - a.data.seq)[0] ?? null,
    accounts,
    cash: pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.venue === me && c.data.owner !== me).map((c) => ({ cid: c.cid, owner: c.data.owner, amount: c.data.amount })),
    incoming,
    outgoing,
    holdings,
  };
}

export interface RailDeps {
  venue: RoleSession;
  /** Null: no registry is configured, so nothing that needs a factory or a choice context is attempted. */
  registry: RegistryClient | null;
  listingId: string;
  nowSec: () => number;
  log: (why: string) => void;
  leaseOf?: LeaseOf;
  allowedPackageIds?: readonly string[];
  /** Take an unaccepted withdrawal back this long after it was sent. */
  refundAfterSec: number;
  /** How long a transfer the venue instructs stays open. */
  transferWindowSec: number;
  /** Who archived the gone instructions (`archivedByExercise` in a deployment), from an offset; without it a gone instruction waits. */
  history?: (instructionCids: readonly ContractId[], fromOffset: number) => Promise<ReadonlyMap<ContractId, "accepted" | "rejected">>;
  /** The most input holdings one transfer may use. */
  maxInputs?: number;
  /** Attest at least this often when anything moved; 0 = every pass. */
  attestEverySec: number;
}

export interface RailPassResult {
  settled: number;
  rejected: number;
  held: number;
  accepted: number;
  declined: number;
  completed: number;
  refunded: number;
  attested: boolean;
  failures: string[];
}

const blank = (): RailPassResult => ({ settled: 0, rejected: 0, held: 0, accepted: 0, declined: 0, completed: 0, refunded: 0, attested: false, failures: [] });

let lastAttestSec = 0;
/** Test seam: forget when the last statement went out. */
export const resetRailClock = (): void => {
  lastAttestSec = 0;
};

/** One pass. Reads once, executes every plan, never throws: a failed command is counted and logged, the pass goes on. */
export async function railPass(deps: RailDeps): Promise<RailPassResult> {
  const out = blank();
  const snap = await readRail(deps.venue, deps.listingId);
  if (!snap.listing) {
    deps.log(`cc-rail: no listing ${deps.listingId} for ${deps.venue.party}; nothing to do`);
    return out;
  }
  const listing = snap.listing;
  const now = deps.nowSec();
  const attempt = async (what: string, run: () => Promise<void>): Promise<boolean> => {
    try {
      await run();
      return true;
    } catch (error) {
      const text = `${what}: ${failureText(error)}`;
      out.failures.push(text);
      deps.log(`cc-rail ${text}`);
      return false;
    }
  };
  const send = async (commandId: string, command: ReturnType<typeof cmd.settleDeposit>, ctx: { disclosedContracts: readonly DisclosedContract[] } | null) => {
    await submit(deps.venue, { commandId, commands: [command], ...(ctx && ctx.disclosedContracts.length > 0 ? { disclosedContracts: [...ctx.disclosedContracts] } : {}) });
  };

  // 1. what is in flight; a transfer that is gone is explained by the ledger's history, never guessed
  const gone = snap.withdrawals.filter((w) => w.data.state === "WdSent" && w.data.instructionCid && !snap.outgoing.has(w.data.instructionCid));
  let explained: ReadonlyMap<ContractId, "accepted" | "rejected"> = new Map();
  if (gone.length > 0 && deps.history) {
    await attempt("history", async () => {
      explained = await deps.history!(gone.map((w) => w.data.instructionCid!), Math.min(...gone.map((w) => w.createdOffset)) - 1);
    });
  }
  const inFlight = planInFlight({
    withdrawals: snap.withdrawals, liveInstructions: snap.outgoing, accounts: snap.accounts, allowances: snap.allowances,
    archivedBy: (cid) => explained.get(cid) ?? "unknown", refundAfterSec: deps.refundAfterSec, nowSec: now,
  });
  for (const p of inFlight) {
    if (p.kind === "complete") {
      if (await attempt(`complete ${p.withdrawalCid}`, () => send(ids.completeWithdrawalCommandId(p.withdrawalCid), cmd.completeWithdrawal(p.withdrawalCid), null))) out.completed += 1;
    } else if (p.kind === "refund") {
      const w = snap.withdrawals.find((x) => x.cid === p.withdrawalCid);
      if (!w?.data.instructionCid || !deps.registry) {
        out.held += 1;
        continue;
      }
      const instructionCid = w.data.instructionCid;
      const registry = deps.registry;
      if (
        await attempt(`refund ${p.withdrawalCid}`, async () => {
          const ctx = await registry.instructionContext("withdraw", instructionCid);
          await send(ids.refundWithdrawalCommandId(p.withdrawalCid), cmd.refundWithdrawal(p.withdrawalCid, { accountCid: p.accountCid, allowanceCid: p.allowanceCid, context: ctx }), ctx);
        })
      ) {
        out.refunded += 1;
      }
    } else if (p.kind === "orphan") {
      const returned = unlockedHoldings(deps.venue.party, listing.data, snap.holdings).map((h) => h.cid);
      if (await attempt(`refund returned ${p.withdrawalCid}`, () => send(ids.refundWithdrawalCommandId(p.withdrawalCid), cmd.refundReturned(p.withdrawalCid, { accountCid: p.accountCid, allowanceCid: p.allowanceCid, returned }), null))) {
        out.refunded += 1;
      }
    }
  }

  // 2. deposits
  const deposits = planDeposits({
    venue: deps.venue.party, listing: listing.data, instructions: snap.incoming, accounts: snap.accounts, allowances: snap.allowances,
    ...(deps.allowedPackageIds ? { allowedPackageIds: deps.allowedPackageIds } : {}), ...(deps.leaseOf ? { leaseOf: deps.leaseOf } : {}), nowSec: now,
  });
  for (const p of deposits) {
    if (p.kind === "hold") {
      out.held += 1;
      continue;
    }
    if (!deps.registry) continue;
    const registry = deps.registry;
    if (p.kind === "settle") {
      if (
        await attempt(`settle ${p.instructionCid}`, async () => {
          const ctx = await registry.instructionContext("accept", p.instructionCid);
          await send(ids.settleDepositCommandId(p.instructionCid), cmd.settleDeposit(listing.cid, { instructionCid: p.instructionCid, accountCid: p.accountCid, allowanceCid: p.allowanceCid, context: ctx }), ctx);
        })
      ) {
        out.settled += 1;
      }
    } else if (
      await attempt(`reject ${p.instructionCid} (${p.reason})`, async () => {
        const ctx = await registry.instructionContext("reject", p.instructionCid);
        await send(ids.rejectDepositCommandId(p.instructionCid), cmd.rejectTransfer(p.instructionCid, ctx), ctx);
      })
    ) {
      out.rejected += 1;
    }
  }

  // 3. withdrawals
  const wds = planWithdrawals({
    venue: deps.venue.party, listing: listing.data, proposals: snap.proposals, accounts: snap.accounts, allowances: snap.allowances, cash: snap.cash,
    holdings: unlockedHoldings(deps.venue.party, listing.data, snap.holdings),
    ...(deps.leaseOf ? { leaseOf: deps.leaseOf } : {}), ...(deps.maxInputs ? { maxInputs: deps.maxInputs } : {}),
  });
  for (const p of wds) {
    if (p.kind === "hold") {
      out.held += 1;
      continue;
    }
    if (p.kind === "decline") {
      if (await attempt(`decline ${p.proposalCid}`, () => send(ids.declineWithdrawalCommandId(p.proposalCid), cmd.declineWithdrawal(p.proposalCid, p.reason), null))) out.declined += 1;
      continue;
    }
    if (!deps.registry) continue;
    const registry = deps.registry;
    const proposal = snap.proposals.find((x) => x.cid === p.proposalCid);
    if (!proposal) continue;
    if (
      await attempt(`accept ${p.proposalCid}`, async () => {
        const args = {
          sender: deps.venue.party, receiver: p.owner, instrumentAdmin: listing.data.instrumentAdmin, instrumentId: listing.data.instrumentId,
          amountAtomic: p.units * (10n ** 10n / listing.data.unitsPerCoin), requestedAtSec: now - 60, executeBeforeSec: now + deps.transferWindowSec,
          inputHoldingCids: p.inputHoldingCids, ref: proposal.data.ref,
        };
        const answer = await registry.transferFactory(cmd.transferChoiceArguments(args));
        await send(
          ids.acceptWithdrawalCommandId(p.proposalCid),
          cmd.acceptWithdrawal(p.proposalCid, {
            listingCid: listing.cid, accountCid: p.accountCid, cashCids: p.cashCids, allowanceCid: p.allowanceCid, factoryCid: answer.factoryId,
            inputHoldingCids: p.inputHoldingCids, requestedAtSec: args.requestedAtSec, executeBeforeSec: args.executeBeforeSec, context: answer.context,
          }),
          answer.context,
        );
      })
    ) {
      out.accepted += 1;
    }
  }

  // 4. the reserve statement, when something moved or it has been a while
  const moved = out.settled + out.accepted + out.completed + out.refunded > 0;
  const due = deps.attestEverySec === 0 || now - lastAttestSec >= deps.attestEverySec;
  if ((moved || snap.statement === null) && due) {
    const fresh = await readRail(deps.venue, deps.listingId);
    if (fresh.listing) {
      const plan = planAttest({ venue: deps.venue.party, listing: fresh.listing.data, holdings: fresh.holdings, allowances: fresh.allowances });
      const seq = fresh.statement ? fresh.statement.data.seq + 1 : 0;
      if (
        await attempt("attest", () =>
          send(ids.attestCommandId(deps.listingId, seq), cmd.attestReserve(fresh.listing!.cid, { holdingCids: plan.holdingCids, allowanceCids: plan.allowanceCids, previous: fresh.statement?.cid ?? null, asOfSec: now }), null),
        )
      ) {
        out.attested = true;
        lastAttestSec = now;
        if (!plan.covered) deps.log(`cc-rail ALERT: the reserve is short: ${plan.heldUnits} cash units of coin held against ${plan.liabilityUnits} owed`);
      }
    }
  }
  return out;
}
