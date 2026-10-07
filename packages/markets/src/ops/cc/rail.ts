/**
 * The Canton Coin rail's venue-side pass (C7b): read what the venue can see, plan with `policy.ts`, execute the plan.
 * The order matters, and the snapshot is read again between the phases that change what the next one needs:
 *
 *   1. what is in flight (a refund restores cash and allowance) and duplicate allowances (merged);
 *   2. withdrawals (they debit cash and lower an allowance a deposit may then raise), then deposits: every settle first,
 *      then a bounded number of rejects, so a flood of dust from strangers cannot starve real work;
 *   3. the reserve statement.
 *
 * Every command has a stable id (`ids.ts`), so a crash between reading and executing repeats nothing. `railPass` catches
 * a failed command and goes on; only its first read can throw (the actor catches that).
 *
 * Nothing here contacts a node in a test: the session's client and the registry client are injected. It is built from the
 * JSON Ledger API and registry API specifications and has not run against a participant (`docs/evidence/c7b-canton-coin.md`).
 */
import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import type { ContractId, CreatedEvent, DisclosedContract, Party } from "@owarine/ledger";
import { atomicPerCashUnit } from "@owarine/ledger/pure";
import { decodeVenueAccount, decodeVenueCash } from "../canton/decode";
import { failureText, pick, submit, type RoleSession } from "../canton/session";
import * as cmd from "./commands";
import {
  decodeAllowance, decodeHoldingView, decodeListing, decodeProposal, decodeStatement, decodeTransferInstructionView, decodeWithdrawal, interfaceViewOf,
  type AllowanceC, type ListingC, type ProposalC, type StatementC, type WithdrawalC,
} from "./decode";
import * as ids from "./ids";
import { planMerges, type Row } from "./allowances";
import { planDeposits, planInFlight, planWithdrawals, type CashRow, type InstructionRow, type LeaseOf } from "./policy";
import { planAttest, unlockedHoldings, type HoldingRow } from "./reserve";
import type { RegistryClient } from "./registry";

export interface RailSnapshot {
  listing: Row<ListingC> | null;
  /** Every allowance of the venue, of any listing: the planners pick the ones under a listing's terms; a statement counts the instrument's. */
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
  /** The venue's own holdings of any instrument (the plans keep the registry-signed ones of the listed instrument). */
  holdings: HoldingRow[];
}

const RAIL_TEMPLATES = [
  CC_TEMPLATE_IDS.CcListing, CC_TEMPLATE_IDS.CcAllowance, CC_TEMPLATE_IDS.CcWithdrawProposal, CC_TEMPLATE_IDS.CcWithdrawal, CC_TEMPLATE_IDS.CcReserveStatement,
  TEMPLATE_IDS.VenueAccount, TEMPLATE_IDS.VenueCash,
] as const;

const signedBy = (e: CreatedEvent, party: Party): boolean => e.signatories.includes(party);

/** Read the rail's state as the venue sees it: two paged snapshots (templates, then the CIP-56 interfaces). */
export async function readRail(venue: RoleSession, listingId: string): Promise<RailSnapshot> {
  const me = venue.party;
  const acs = (await venue.client.activeContracts({ parties: [me], templateIds: [...RAIL_TEMPLATES], maxPageSize: 500 })).contracts;
  const views = (
    await venue.client.activeContracts({ parties: [me], interfaceIds: [CIP56_INTERFACE_IDS.Holding, CIP56_INTERFACE_IDS.TransferInstruction], maxPageSize: 500 })
  ).contracts;

  // A rail record counts only if the venue signed it: a stranger can name the venue as an observer of anything.
  const mine = acs.filter((c) => signedBy(c.createdEvent, me));
  const listings = pick(mine, CC_TEMPLATE_IDS.CcListing, decodeListing).filter((l) => l.data.venue === me && l.data.listingId === listingId);
  const statements = pick(mine, CC_TEMPLATE_IDS.CcReserveStatement, decodeStatement).filter((s) => s.data.venue === me && s.data.listingId === listingId);
  const offsets = new Map(acs.map((c) => [c.createdEvent.contractId, c.createdEvent.offset]));
  const accounts = new Map<Party, ContractId>();
  for (const a of pick(mine, TEMPLATE_IDS.VenueAccount, decodeVenueAccount)) if (a.data.venue === me) accounts.set(a.data.owner, a.cid);

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
        if (v.owner === me) holdings.push({ cid: e.contractId, templateId: e.templateId, signatories: e.signatories, view: v });
      } catch {
        /* likewise */
      }
    }
  }
  return {
    listing: listings[0] ?? null,
    allowances: pick(mine, CC_TEMPLATE_IDS.CcAllowance, decodeAllowance).filter((a) => a.data.venue === me),
    proposals: pick(acs, CC_TEMPLATE_IDS.CcWithdrawProposal, decodeProposal)
      .filter((p) => p.data.venue === me && p.data.listingId === listingId)
      .map((p) => ({ ...p, createdOffset: offsets.get(p.cid) ?? 0 })),
    withdrawals: pick(mine, CC_TEMPLATE_IDS.CcWithdrawal, decodeWithdrawal)
      .filter((w) => w.data.venue === me && w.data.listingId === listingId)
      .map((w) => ({ ...w, createdOffset: offsets.get(w.cid) ?? 0 })),
    statement: statements.sort((a, b) => b.data.seq - a.data.seq)[0] ?? null,
    accounts,
    cash: pick(mine, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.venue === me && c.data.owner !== me).map((c) => ({ cid: c.cid, owner: c.data.owner, amount: c.data.amount })),
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
  /** Read a party's lease again just before its command goes out (K-224: a seat can be re-leased mid-pass). Null = none live. */
  freshLease?: (party: Party) => Promise<{ startOffset: number } | null>;
  allowedPackageIds?: readonly string[];
  /** Take an unaccepted withdrawal back this long after it was sent. */
  refundAfterSec: number;
  /** How long a transfer the venue instructs stays open. */
  transferWindowSec: number;
  /** Who archived the gone instruction, searched from the given offset (`archivedByExercise` in a deployment); without it a gone instruction waits. */
  history?: (instructionCids: readonly ContractId[], fromOffset: number) => Promise<ReadonlyMap<ContractId, "accepted" | "rejected">>;
  /** The most input holdings one transfer may use. */
  maxInputs?: number;
  /** Attest at least this often when anything moved; 0 = every pass. */
  attestEverySec: number;
  /** The most rejects one pass sends: a flood of unwanted transfers cannot starve the real work. */
  maxRejectsPerPass?: number;
}

export interface RailPassResult {
  settled: number;
  rejected: number;
  held: number;
  accepted: number;
  declined: number;
  completed: number;
  refunded: number;
  merged: number;
  /** Transfers the owner rejected outside the receipt: the coin is back, nothing refunds it, an operator must look. */
  orphaned: number;
  attested: boolean;
  failures: string[];
}

const blank = (): RailPassResult => ({ settled: 0, rejected: 0, held: 0, accepted: 0, declined: 0, completed: 0, refunded: 0, merged: 0, orphaned: 0, attested: false, failures: [] });

/** When each listing's last statement went out, by venue and listing: not one clock for the whole process. */
const lastAttest = new Map<string, number>();
/** Test seam: forget when the last statement went out. */
export const resetRailClock = (): void => {
  lastAttest.clear();
};

/** One pass. Executes every plan; a failed command is counted and logged and the pass goes on. Only its first read can throw. */
export async function railPass(deps: RailDeps): Promise<RailPassResult> {
  const out = blank();
  let snap = await readRail(deps.venue, deps.listingId);
  if (!snap.listing) {
    deps.log(`cc-rail: no listing ${deps.listingId} for ${deps.venue.party}; nothing to do`);
    return out;
  }
  const listing = snap.listing;
  const me = deps.venue.party;
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
  const send = async (commandId: string, command: cmd.RailCommand, ctx: { disclosedContracts: readonly DisclosedContract[] } | null, readAs?: readonly Party[]) => {
    await submit(deps.venue, {
      commandId,
      commands: [command],
      ...(ctx && ctx.disclosedContracts.length > 0 ? { disclosedContracts: [...ctx.disclosedContracts] } : {}),
      ...(readAs ? { readAs } : {}),
    });
  };
  const reread = async (): Promise<boolean> => {
    try {
      snap = await readRail(deps.venue, deps.listingId);
      return snap.listing !== null;
    } catch (error) {
      out.failures.push(`re-read: ${failureText(error)}`);
      return false;
    }
  };
  /** A seat re-leased since the plan was made is no longer the one that asked (K-224): skip its command. */
  const stillLeased = async (owner: Party, createdOffset: number): Promise<boolean> => {
    if (!deps.freshLease) return true;
    const lease = await deps.freshLease(owner).catch(() => null);
    return lease !== null && createdOffset >= lease.startOffset;
  };
  let listingCid = listing.cid;

  // 1a. what is in flight; a transfer that is gone is explained by the ledger's history, never guessed
  const gone = snap.withdrawals.filter((w) => w.data.state === "WdSent" && w.data.instructionCid && !snap.outgoing.has(w.data.instructionCid));
  const explained = new Map<ContractId, "accepted" | "rejected">();
  if (gone.length > 0 && deps.history) {
    // Each from its own offset: one old receipt whose archive is beyond the scan cannot hide the others.
    for (const w of gone) {
      await attempt(`history ${w.cid}`, async () => {
        const found = await deps.history!([w.data.instructionCid!], w.createdOffset - 1);
        for (const [cid, by] of found) explained.set(cid, by);
      });
    }
  }
  const stuck = gone.filter((w) => !explained.has(w.data.instructionCid!)).length;
  if (stuck > 0) deps.log(`cc-rail: ${stuck} transfer(s) in flight are gone from the registry and the ledger's history does not say why; they wait`);
  const inFlight = planInFlight({
    withdrawals: snap.withdrawals, liveInstructions: snap.outgoing, accounts: snap.accounts, allowances: snap.allowances, listing: listing.data,
    archivedBy: (cid) => explained.get(cid) ?? "unknown", refundAfterSec: deps.refundAfterSec, nowSec: now,
  });
  let changed = false;
  for (const p of inFlight) {
    if (p.kind === "complete") {
      if (await attempt(`complete ${p.withdrawalCid}`, () => send(ids.completeWithdrawalCommandId(p.withdrawalCid), cmd.completeWithdrawal(p.withdrawalCid), null))) {
        out.completed += 1;
        changed = true;
      }
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
        changed = true;
      }
    } else if (p.kind === "orphan") {
      out.orphaned += 1;
      deps.log(`cc-rail ALERT: ${p.owner} ${p.why}: the coin is back with the venue and the cash is not refunded; the owner's own way is Withdrawal_OwnerReject, an operator decides the rest (${p.withdrawalCid})`);
    }
  }
  // 1b. duplicate allowances of one owner fold into one, so a withdrawal is never declined for being in pieces
  for (const m of planMerges(snap.allowances, listing.data)) {
    if (await attempt(`merge allowances ${m.keep}`, () => send(ids.mergeAllowancesCommandId(m.keep, m.others), cmd.mergeAllowances(m.keep, m.others), null))) {
      out.merged += 1;
      changed = true;
    }
  }
  if (changed) {
    if (!(await reread())) return out;
    listingCid = snap.listing!.cid;
    changed = false;
  }
  const at = snap.listing!;

  // 2a. withdrawals
  const wds = planWithdrawals({
    venue: me, listing: at.data, proposals: snap.proposals, accounts: snap.accounts, allowances: snap.allowances, cash: snap.cash,
    holdings: unlockedHoldings(me, at.data, snap.holdings, deps.allowedPackageIds), nowSec: now,
    ...(deps.leaseOf ? { leaseOf: deps.leaseOf } : {}), ...(deps.maxInputs ? { maxInputs: deps.maxInputs } : {}),
  });
  for (const p of wds) {
    if (p.kind === "hold") {
      out.held += 1;
      continue;
    }
    const proposal = snap.proposals.find((x) => x.cid === p.proposalCid);
    if (!proposal) continue;
    if (!(await stillLeased(proposal.data.owner, proposal.createdOffset))) {
      out.held += 1;
      continue;
    }
    if (p.kind === "decline") {
      if (await attempt(`decline ${p.proposalCid}`, () => send(ids.declineWithdrawalCommandId(p.proposalCid), cmd.declineWithdrawal(p.proposalCid, p.reason), null))) out.declined += 1;
      continue;
    }
    if (!deps.registry) continue;
    const registry = deps.registry;
    if (
      await attempt(`accept ${p.proposalCid}`, async () => {
        const args = {
          sender: me, receiver: p.owner, instrumentAdmin: at.data.instrumentAdmin, instrumentId: at.data.instrumentId,
          amountAtomic: p.units * atomicPerCashUnit(at.data.unitsPerCoin), requestedAtSec: now - 60, executeBeforeSec: now + deps.transferWindowSec,
          inputHoldingCids: p.inputHoldingCids, ref: proposal.data.ref,
        };
        const answer = await registry.transferFactory(cmd.transferChoiceArguments(args));
        await send(
          ids.acceptWithdrawalCommandId(p.proposalCid),
          cmd.acceptWithdrawal(p.proposalCid, {
            listingCid, accountCid: p.accountCid, cashCids: p.cashCids, allowanceCid: p.allowanceCid, factoryCid: answer.factoryId,
            inputHoldingCids: p.inputHoldingCids, requestedAtSec: args.requestedAtSec, executeBeforeSec: args.executeBeforeSec, context: answer.context,
          }),
          answer.context,
          [p.owner],
        );
      })
    ) {
      out.accepted += 1;
      changed = true;
    }
  }
  if (changed) {
    if (!(await reread())) return out;
    listingCid = snap.listing!.cid;
    changed = false;
  }

  // 2b. deposits: settles first, then a bounded number of rejects
  const deposits = planDeposits({
    venue: me, listing: snap.listing!.data, instructions: snap.incoming, accounts: snap.accounts, allowances: snap.allowances,
    ...(deps.allowedPackageIds ? { allowedPackageIds: deps.allowedPackageIds } : {}), ...(deps.leaseOf ? { leaseOf: deps.leaseOf } : {}), nowSec: now,
  });
  const byCid = new Map(snap.incoming.map((r) => [r.cid, r]));
  let rejects = 0;
  const maxRejects = deps.maxRejectsPerPass ?? 20;
  for (const p of deposits.filter((d) => d.kind === "settle")) {
    if (p.kind !== "settle" || !deps.registry) continue;
    const registry = deps.registry;
    if (!(await stillLeased(p.owner, byCid.get(p.instructionCid)?.createdOffset ?? 0))) {
      out.held += 1;
      continue;
    }
    if (
      await attempt(`settle ${p.instructionCid}`, async () => {
        const ctx = await registry.instructionContext("accept", p.instructionCid);
        await send(ids.settleDepositCommandId(p.instructionCid), cmd.settleDeposit(listingCid, { instructionCid: p.instructionCid, accountCid: p.accountCid, allowanceCid: p.allowanceCid, context: ctx }), ctx);
      })
    ) {
      out.settled += 1;
      changed = true;
    }
  }
  for (const p of deposits) {
    if (p.kind === "hold") {
      out.held += 1;
      continue;
    }
    if (p.kind !== "reject" || !deps.registry) continue;
    if (rejects >= maxRejects) {
      out.held += 1;
      continue;
    }
    rejects += 1;
    const registry = deps.registry;
    if (
      await attempt(`reject ${p.instructionCid} (${p.reason})`, async () => {
        const ctx = await registry.instructionContext("reject", p.instructionCid);
        await send(ids.rejectDepositCommandId(p.instructionCid), cmd.rejectTransfer(p.instructionCid, ctx), ctx);
      })
    ) {
      out.rejected += 1;
    }
  }

  // 3. the reserve statement, when something moved (or none exists yet) and it is due
  const moved = out.settled + out.accepted + out.completed + out.refunded + out.merged > 0;
  const clock = `${me}\n${deps.listingId}`;
  const due = deps.attestEverySec === 0 || now - (lastAttest.get(clock) ?? 0) >= deps.attestEverySec;
  if ((moved || snap.statement === null) && due) {
    if (changed && !(await reread())) return out;
    await attempt("attest", async () => {
      const fresh = snap;
      if (!fresh.listing) return;
      const plan = planAttest({ venue: me, listing: fresh.listing.data, holdings: fresh.holdings, allowances: fresh.allowances, ...(deps.allowedPackageIds ? { allowedPackageIds: deps.allowedPackageIds } : {}) });
      const seq = fresh.statement ? fresh.statement.data.seq + 1 : 0;
      await send(ids.attestCommandId(deps.listingId, seq), cmd.attestReserve(fresh.listing.cid, { holdingCids: plan.holdingCids, allowanceCids: plan.allowanceCids, previous: fresh.statement?.cid ?? null }), null);
      out.attested = true;
      lastAttest.set(clock, now);
      if (!plan.covered) deps.log(`cc-rail ALERT: the reserve is short: ${plan.heldAtomic} atomic units of coin held against ${plan.liabilityAtomic} owed`);
    });
  }
  return out;
}
