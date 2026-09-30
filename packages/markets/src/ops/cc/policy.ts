/**
 * What the venue's ops actor decides about the Canton Coin rail, as pure functions over a snapshot (C7b). The ledger's
 * choices enforce the money (exact conversion, one settle per instruction, the allowance cap); this module decides
 * which choice to send next and, for everything Daml cannot see, refuses to send it:
 *
 *   authenticity  an interface view is what the contract's own template SAYS. A transfer instruction is settled only if
 *                 its signatories include the listing's `instrumentAdmin` (a look-alike template on a shared participant
 *                 cannot have the registry's party sign it), and its template's package is on the allow-list when there is one.
 *   lease         a deposit is credited to the party that sent it; if that seat's lease began after the instruction was
 *                 created the party has a new visitor (K-224), so the coin is rejected back instead of credited.
 *   dust, bounds  refused before a settle is tried (the ledger refuses too; the instruction is rejected back to the sender).
 *
 * Nothing here talks to a ledger; `rail.ts` reads the snapshot and executes the plan.
 */
import { atomicToCashUnitsExact, atomicPerCashUnit, cashUnitsToCc, ccRateOk, UnitsError, type ContractId, type Party } from "@agari/ledger/pure";
import type { AllowanceC, HoldingViewC, ListingC, ProposalC, TransferInstructionViewC, WithdrawalC } from "./decode";

export interface Row<T> {
  cid: ContractId;
  data: T;
}

export interface InstructionRow {
  cid: ContractId;
  /** The created event's template id (package-id form): its package is what the allow-list checks. */
  templateId: string;
  signatories: readonly Party[];
  /** The ledger offset the contract was created at (a seat's lease starts at an offset). */
  createdOffset: number;
  view: TransferInstructionViewC;
}

export interface HoldingRow {
  cid: ContractId;
  view: HoldingViewC;
}

/** A seat's lease, for the K-224 rule: the instruction or proposal must be at or after `startOffset`. */
export type LeaseOf = (party: Party) => { startOffset: number } | null;

export type RejectReason = "dust" | "below-minimum" | "above-maximum" | "listing-closed" | "stale-lease" | "expired";
export type HoldReason = "not-to-venue" | "not-pending" | "forged" | "no-account" | "package-not-allowed" | "not-a-listing-transfer";

export type DepositPlan =
  | { kind: "settle"; instructionCid: ContractId; owner: Party; accountCid: ContractId; allowanceCid: ContractId | null; units: bigint; amountAtomic: bigint }
  | { kind: "reject"; instructionCid: ContractId; owner: Party; reason: RejectReason; detail: string }
  | { kind: "hold"; instructionCid: ContractId; reason: HoldReason; detail: string };

export interface DepositInput {
  venue: Party;
  listing: ListingC;
  instructions: readonly InstructionRow[];
  /** owner → the VenueAccount cid. */
  accounts: ReadonlyMap<Party, ContractId>;
  allowances: readonly Row<AllowanceC>[];
  /** Package ids (the first part of a template id) the registry's instruction templates may come from; empty = any. */
  allowedPackageIds?: readonly string[];
  leaseOf?: LeaseOf;
  nowSec: number;
}

const packageOf = (templateId: string): string => templateId.slice(0, templateId.indexOf(":"));

/** One plan per instruction the venue can see. Pure and total: every instruction is settled, rejected back or held. */
export function planDeposits(i: DepositInput): DepositPlan[] {
  const out: DepositPlan[] = [];
  // One settle per owner per pass: two settles for one owner would both name the same allowance and one would fail.
  const settledOwners = new Set<Party>();
  for (const row of i.instructions) {
    const v = row.view;
    if (v.receiver !== i.venue) {
      out.push({ kind: "hold", instructionCid: row.cid, reason: "not-to-venue", detail: "the transfer is not to the venue" });
      continue;
    }
    if (v.instrumentAdmin !== i.listing.instrumentAdmin || v.instrumentId !== i.listing.instrumentId) {
      // An instrument the venue does not list. Not a listing transfer at all: reject it back only if the registry is the
      // right one; otherwise it is somebody else's noise and is left alone.
      out.push({ kind: "hold", instructionCid: row.cid, reason: "not-a-listing-transfer", detail: `${v.instrumentId} of ${v.instrumentAdmin} is not this listing's instrument` });
      continue;
    }
    if (!row.signatories.includes(i.listing.instrumentAdmin)) {
      out.push({ kind: "hold", instructionCid: row.cid, reason: "forged", detail: "the instruction is not signed by the instrument's registry" });
      continue;
    }
    if (i.allowedPackageIds && i.allowedPackageIds.length > 0 && !i.allowedPackageIds.includes(packageOf(row.templateId))) {
      out.push({ kind: "hold", instructionCid: row.cid, reason: "package-not-allowed", detail: `template package ${packageOf(row.templateId)} is not on the allow-list` });
      continue;
    }
    if (v.status !== "PendingReceiverAcceptance") {
      out.push({ kind: "hold", instructionCid: row.cid, reason: "not-pending", detail: "the transfer is not waiting on the venue" });
      continue;
    }
    const owner = v.sender;
    if (v.executeBeforeSec <= i.nowSec) {
      out.push({ kind: "reject", instructionCid: row.cid, owner, reason: "expired", detail: "the transfer's window has closed" });
      continue;
    }
    if (!i.listing.depositsOpen) {
      out.push({ kind: "reject", instructionCid: row.cid, owner, reason: "listing-closed", detail: "the listing takes no new deposits" });
      continue;
    }
    const lease = i.leaseOf?.(owner) ?? null;
    if (i.leaseOf && (!lease || row.createdOffset < lease.startOffset)) {
      out.push({ kind: "reject", instructionCid: row.cid, owner, reason: "stale-lease", detail: "the sending seat was leased again since this transfer (K-224)" });
      continue;
    }
    let units: bigint;
    try {
      units = atomicToCashUnitsExact(v.amountAtomic, i.listing.unitsPerCoin);
    } catch (error) {
      if (error instanceof UnitsError) {
        out.push({ kind: "reject", instructionCid: row.cid, owner, reason: "dust", detail: error.message });
        continue;
      }
      throw error;
    }
    if (units < i.listing.minDepositUnits) {
      out.push({ kind: "reject", instructionCid: row.cid, owner, reason: "below-minimum", detail: `${units} cash units is below the minimum ${i.listing.minDepositUnits}` });
      continue;
    }
    if (units > i.listing.maxDepositUnits) {
      out.push({ kind: "reject", instructionCid: row.cid, owner, reason: "above-maximum", detail: `${units} cash units is above the maximum ${i.listing.maxDepositUnits}` });
      continue;
    }
    const accountCid = i.accounts.get(owner);
    if (!accountCid) {
      out.push({ kind: "hold", instructionCid: row.cid, reason: "no-account", detail: "the sender has no venue account yet" });
      continue;
    }
    if (settledOwners.has(owner)) continue; // next pass: this owner's allowance moves with the first settle
    settledOwners.add(owner);
    const allowance = i.allowances.find((a) => a.data.owner === owner && a.data.listingId === i.listing.listingId);
    out.push({ kind: "settle", instructionCid: row.cid, owner, accountCid, allowanceCid: allowance?.cid ?? null, units, amountAtomic: v.amountAtomic });
  }
  return out;
}

// ---- withdrawals ----------------------------------------------------------------------------------

export interface CashRow {
  cid: ContractId;
  owner: Party;
  amount: bigint;
}

export type WithdrawPlan =
  | {
      kind: "accept";
      proposalCid: ContractId;
      owner: Party;
      units: bigint;
      accountCid: ContractId;
      cashCids: ContractId[];
      allowanceCid: ContractId;
      inputHoldingCids: ContractId[];
      amount: string;
    }
  | { kind: "decline"; proposalCid: ContractId; owner: Party; reason: string }
  | { kind: "hold"; proposalCid: ContractId; reason: string };

export interface WithdrawInput {
  venue: Party;
  listing: ListingC;
  proposals: readonly (Row<ProposalC> & { createdOffset: number })[];
  accounts: ReadonlyMap<Party, ContractId>;
  allowances: readonly Row<AllowanceC>[];
  cash: readonly CashRow[];
  /** The venue's own unlocked holdings of the listed instrument. */
  holdings: readonly HoldingRow[];
  leaseOf?: LeaseOf;
  /** The most input holdings one transfer may use (Canton Coin: 100). */
  maxInputs?: number;
}

/** Cover `needAtomic` from the venue's unlocked holdings, fewest and largest first; null when they do not cover it. */
export function coverHoldings(holdings: readonly HoldingRow[], needAtomic: bigint, maxInputs = 100): HoldingRow[] | null {
  const sorted = [...holdings].sort((a, b) => (a.view.amountAtomic === b.view.amountAtomic ? 0 : a.view.amountAtomic > b.view.amountAtomic ? -1 : 1));
  const picked: HoldingRow[] = [];
  let sum = 0n;
  for (const h of sorted) {
    if (sum >= needAtomic) break;
    if (picked.length >= maxInputs) return null;
    picked.push(h);
    sum += h.view.amountAtomic;
  }
  return sum >= needAtomic ? picked : null;
}

/** Cover `units` from the owner's own cash, largest first. */
export function coverCash(cash: readonly CashRow[], units: bigint): CashRow[] | null {
  const sorted = [...cash].sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));
  const picked: CashRow[] = [];
  let sum = 0n;
  for (const c of sorted) {
    if (sum >= units) break;
    picked.push(c);
    sum += c.amount;
  }
  return sum >= units ? picked : null;
}

/**
 * One plan per open proposal, and the holdings each accept reserves so two accepts in one pass never name the same
 * coin. A proposal the venue cannot honour for a reason of the owner's (bounds, allowance, cash, lease) is declined
 * with that reason; one it cannot honour for a reason of its own (no account yet, not enough coin in hand) is held.
 */
export function planWithdrawals(i: WithdrawInput): WithdrawPlan[] {
  const out: WithdrawPlan[] = [];
  const used = new Set<ContractId>();
  const maxInputs = i.maxInputs ?? 100;
  const spentCash = new Set<ContractId>();
  const spentAllowance = new Set<ContractId>();
  for (const p of i.proposals) {
    const d = p.data;
    if (d.venue !== i.venue || d.listingId !== i.listing.listingId) {
      out.push({ kind: "hold", proposalCid: p.cid, reason: "another listing's proposal" });
      continue;
    }
    if (d.units <= 0n || !ccRateOk(i.listing.unitsPerCoin)) {
      out.push({ kind: "decline", proposalCid: p.cid, owner: d.owner, reason: "the amount is not valid" });
      continue;
    }
    let amount: string;
    try {
      amount = cashUnitsToCc(d.units, i.listing.unitsPerCoin);
    } catch {
      out.push({ kind: "decline", proposalCid: p.cid, owner: d.owner, reason: "the amount is outside the rail's bounds" });
      continue;
    }
    const lease = i.leaseOf?.(d.owner) ?? null;
    if (i.leaseOf && (!lease || p.createdOffset < lease.startOffset)) {
      out.push({ kind: "decline", proposalCid: p.cid, owner: d.owner, reason: "the seat was leased again since this request" });
      continue;
    }
    const accountCid = i.accounts.get(d.owner);
    if (!accountCid) {
      out.push({ kind: "hold", proposalCid: p.cid, reason: "the owner has no venue account" });
      continue;
    }
    const allowance = i.allowances.find((a) => a.data.owner === d.owner && a.data.listingId === d.listingId);
    if (!allowance || allowance.data.units < d.units) {
      out.push({ kind: "decline", proposalCid: p.cid, owner: d.owner, reason: "only coin that was deposited and not yet taken back can be withdrawn" });
      continue;
    }
    if (spentAllowance.has(allowance.cid)) {
      out.push({ kind: "hold", proposalCid: p.cid, reason: "this owner's allowance moves with an earlier withdrawal; next pass" });
      continue;
    }
    const mine = i.cash.filter((c) => c.owner === d.owner && !spentCash.has(c.cid));
    const cashCover = coverCash(mine, d.units);
    if (!cashCover) {
      out.push({ kind: "decline", proposalCid: p.cid, owner: d.owner, reason: "the seat's cash does not cover this withdrawal" });
      continue;
    }
    const need = d.units * atomicPerCashUnit(i.listing.unitsPerCoin);
    const free = i.holdings.filter((h) => !used.has(h.cid));
    const cover = coverHoldings(free, need, maxInputs);
    if (!cover) {
      out.push({ kind: "hold", proposalCid: p.cid, reason: "the venue does not hold enough coin in hand for this withdrawal" });
      continue;
    }
    for (const h of cover) used.add(h.cid);
    for (const c of cashCover) spentCash.add(c.cid);
    spentAllowance.add(allowance.cid);
    out.push({
      kind: "accept", proposalCid: p.cid, owner: d.owner, units: d.units, accountCid, cashCids: cashCover.map((c) => c.cid), allowanceCid: allowance.cid,
      inputHoldingCids: cover.map((h) => h.cid), amount,
    });
  }
  return out;
}

// ---- withdrawals in flight ----------------------------------------------------------------------------

export type InFlightPlan =
  | { kind: "complete"; withdrawalCid: ContractId; owner: Party }
  | { kind: "refund"; withdrawalCid: ContractId; owner: Party; accountCid: ContractId; allowanceCid: ContractId | null; why: string }
  | { kind: "orphan"; withdrawalCid: ContractId; owner: Party; accountCid: ContractId; allowanceCid: ContractId | null; why: string }
  | { kind: "wait"; withdrawalCid: ContractId };

export interface InFlightInput {
  withdrawals: readonly Row<WithdrawalC>[];
  /** The transfer instructions still active for the venue as sender, by cid. */
  liveInstructions: ReadonlyMap<ContractId, { executeBeforeSec: number }>;
  accounts: ReadonlyMap<Party, ContractId>;
  allowances: readonly Row<AllowanceC>[];
  /** Ask the ledger's history who archived a gone instruction: accepted by the owner, or rejected. */
  archivedBy: (instructionCid: ContractId) => "accepted" | "rejected" | "unknown";
  /** Take an unaccepted transfer back this long after it was sent. */
  refundAfterSec: number;
  nowSec: number;
}

/**
 * A withdrawal in state Sent: still pending and past its window (or older than `refundAfterSec`) → take it back and
 * refund; gone because the owner accepted → record it completed; gone because the owner rejected → refund against the
 * returned coin (`orphan`); gone for an unknown reason → wait, and let the operator look (it is never guessed).
 */
export function planInFlight(i: InFlightInput): InFlightPlan[] {
  const out: InFlightPlan[] = [];
  for (const w of i.withdrawals) {
    const d = w.data;
    if (d.state !== "WdSent" || !d.instructionCid) continue;
    const accountCid = i.accounts.get(d.owner);
    const allowance = i.allowances.find((a) => a.data.owner === d.owner && a.data.listingId === d.listingId);
    const live = i.liveInstructions.get(d.instructionCid);
    if (live) {
      const late = live.executeBeforeSec <= i.nowSec || d.openedAtSec + i.refundAfterSec <= i.nowSec;
      if (late && accountCid) out.push({ kind: "refund", withdrawalCid: w.cid, owner: d.owner, accountCid, allowanceCid: allowance?.cid ?? null, why: "the owner never accepted the transfer" });
      else out.push({ kind: "wait", withdrawalCid: w.cid });
      continue;
    }
    const by = i.archivedBy(d.instructionCid);
    if (by === "accepted") out.push({ kind: "complete", withdrawalCid: w.cid, owner: d.owner });
    else if (by === "rejected" && accountCid) out.push({ kind: "orphan", withdrawalCid: w.cid, owner: d.owner, accountCid, allowanceCid: allowance?.cid ?? null, why: "the owner rejected the transfer" });
    else out.push({ kind: "wait", withdrawalCid: w.cid });
  }
  return out;
}

// ---- the reserve statement ----------------------------------------------------------------------------

export interface AttestPlan {
  holdingCids: ContractId[];
  allowanceCids: ContractId[];
  /** What the statement will say, computed here the way the ledger computes it: the check before sending. */
  heldAtomic: bigint;
  liabilityUnits: bigint;
  heldUnits: bigint;
  covered: boolean;
}

/** The venue's own holdings of the listed instrument that are not locked: what a withdrawal can spend and a statement counts. */
export function unlockedHoldings(venue: Party, listing: ListingC, holdings: readonly HoldingRow[]): HoldingRow[] {
  return holdings.filter((h) => h.view.owner === venue && h.view.instrumentAdmin === listing.instrumentAdmin && h.view.instrumentId === listing.instrumentId && h.view.lock === null);
}

/** Every unlocked holding of the instrument the venue owns and every allowance of the listing, and what they add up to. */
export function planAttest(a: { venue: Party; listing: ListingC; holdings: readonly HoldingRow[]; allowances: readonly Row<AllowanceC>[] }): AttestPlan {
  const mine = unlockedHoldings(a.venue, a.listing, a.holdings);
  const owed = a.allowances.filter((x) => x.data.listingId === a.listing.listingId);
  const heldAtomic = mine.reduce((s, h) => s + h.view.amountAtomic, 0n);
  const liabilityUnits = owed.reduce((s, x) => s + x.data.units, 0n);
  const heldUnits = heldAtomic / atomicPerCashUnit(a.listing.unitsPerCoin);
  return { holdingCids: mine.map((h) => h.cid), allowanceCids: owed.map((x) => x.cid), heldAtomic, liabilityUnits, heldUnits, covered: heldUnits >= liabilityUnits };
}
