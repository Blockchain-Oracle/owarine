/**
 * Ledger commands of the Canton Coin rail (C7b): one builder per choice the venue's ops actor or a seat exercises. The
 * abu-pm-cc arguments are typed by the generated bindings (`Cc`), the CIP-56 factory choice by the shapes the token
 * standard fixes. Templates are named by package name (`#abu-pm-cc:…`), so a compatible upgrade never changes a caller.
 * Amounts that are `Decimal` on the wire come from `atomicToCc`, never from a number.
 */
import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, type Cc } from "@agari/daml";
import { atomicToCc, toDamlInt, type Command, type ContractId, type DisclosedContract, type Party } from "@agari/ledger/pure";
import { isoOfSec } from "../canton/decode";

/** One ledger command of the rail. */
export type RailCommand = Command;

const exercise = (templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});
const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });

/** A generated payload type with every branded string (ContractId) as plain text, which is what the wire carries. */
type Wire<T> = T extends string ? string : T extends readonly (infer U)[] ? Wire<U>[] : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;
type Listing = Cc.PM.CC.Listing.CcListing;

/** What a registry's choice-context endpoint answers, in the shape a choice argument and a submission take. */
export interface RegistryContext {
  /** `ChoiceContext` JSON (`{ values: { … } }`), passed through untouched. */
  choiceContextData: unknown;
  disclosedContracts: DisclosedContract[];
}

type ExtraArgsWire = Wire<Cc.PM.CC.Listing.Listing_SettleDeposit>["extraArgs"];

/** `ExtraArgs` for a choice: the registry's context (already Daml-LF JSON, passed through untouched), no caller metadata. */
export const extraArgsOf = (ctx: RegistryContext | null): ExtraArgsWire => ({
  context: (ctx?.choiceContextData ?? { values: {} }) as ExtraArgsWire["context"],
  meta: { values: {} },
});

// ---- the venue ---------------------------------------------------------------------------------------

/** Settle one deposit: accept the owner's pending transfer and credit their cash, in one transaction. */
export const settleDeposit = (
  listingCid: ContractId,
  a: { instructionCid: ContractId; accountCid: ContractId; allowanceCid: ContractId | null; context: RegistryContext | null },
): Command =>
  exercise(CC_TEMPLATE_IDS.CcListing, listingCid, "Listing_SettleDeposit", {
    instructionCid: a.instructionCid,
    accountCid: a.accountCid,
    allowanceCid: a.allowanceCid,
    extraArgs: extraArgsOf(a.context),
  } satisfies Wire<Cc.PM.CC.Listing.Listing_SettleDeposit>);

/** Answer a withdrawal proposal: debit the cash, lower the allowance, instruct the transfer back to the owner. */
export const acceptWithdrawal = (
  proposalCid: ContractId,
  a: {
    listingCid: ContractId;
    accountCid: ContractId;
    cashCids: readonly ContractId[];
    allowanceCid: ContractId;
    factoryCid: ContractId;
    inputHoldingCids: readonly ContractId[];
    requestedAtSec: number;
    executeBeforeSec: number;
    context: RegistryContext | null;
  },
): Command =>
  exercise(CC_TEMPLATE_IDS.CcWithdrawProposal, proposalCid, "Proposal_Accept", {
    listingCid: a.listingCid,
    accountCid: a.accountCid,
    cashCids: [...a.cashCids],
    allowanceCid: a.allowanceCid,
    factoryCid: a.factoryCid,
    inputHoldingCids: [...a.inputHoldingCids],
    requestedAt: isoOfSec(a.requestedAtSec),
    executeBefore: isoOfSec(a.executeBeforeSec),
    extraArgs: extraArgsOf(a.context),
  } satisfies Wire<Cc.PM.CC.Withdraw.Proposal_Accept>);

export const declineWithdrawal = (proposalCid: ContractId, reason: string): Command =>
  exercise(CC_TEMPLATE_IDS.CcWithdrawProposal, proposalCid, "Proposal_Decline", { reason } satisfies Wire<Cc.PM.CC.Withdraw.Proposal_Decline>);

/** The owner accepted the transfer: record the withdrawal completed. */
export const completeWithdrawal = (withdrawalCid: ContractId): Command =>
  exercise(CC_TEMPLATE_IDS.CcWithdrawal, withdrawalCid, "Withdrawal_Complete", {});

/** The owner never accepted: take the transfer back and restore the cash and the allowance. */
export const refundWithdrawal = (withdrawalCid: ContractId, a: { accountCid: ContractId; allowanceCid: ContractId | null; context: RegistryContext | null }): Command =>
  exercise(CC_TEMPLATE_IDS.CcWithdrawal, withdrawalCid, "Withdrawal_Refund", {
    accountCid: a.accountCid,
    allowanceCid: a.allowanceCid,
    extraArgs: extraArgsOf(a.context),
  } satisfies Wire<Cc.PM.CC.Records.Withdrawal_Refund>);

/** The owner rejects a pending transfer through the receipt: the token standard's own Reject, and the cash and allowance come back in the same transaction. */
export const ownerRejectWithdrawal = (withdrawalCid: ContractId, a: { accountCid: ContractId; allowanceCid: ContractId | null; context: RegistryContext | null }): Command =>
  exercise(CC_TEMPLATE_IDS.CcWithdrawal, withdrawalCid, "Withdrawal_OwnerReject", {
    accountCid: a.accountCid,
    allowanceCid: a.allowanceCid,
    extraArgs: extraArgsOf(a.context),
  } satisfies Wire<Cc.PM.CC.Records.Withdrawal_OwnerReject>);

/** Fold an owner's duplicate allowances (same terms) into one. */
export const mergeAllowances = (allowanceCid: ContractId, others: readonly ContractId[]): Command =>
  exercise(CC_TEMPLATE_IDS.CcAllowance, allowanceCid, "Allowance_Merge", { others: [...others] } satisfies Wire<Cc.PM.CC.Records.Allowance_Merge>);

/** The venue rejects a deposit it will not take (dust, out of bounds): the registry returns the coin to the sender. */
export const rejectTransfer = (instructionCid: ContractId, context: RegistryContext | null): Command =>
  exercise(CIP56_INTERFACE_IDS.TransferInstruction, instructionCid, "TransferInstruction_Reject", { extraArgs: extraArgsOf(context) });

export const attestReserve = (
  listingCid: ContractId,
  a: { holdingCids: readonly ContractId[]; allowanceCids: readonly ContractId[]; previous: ContractId | null },
): Command =>
  exercise(CC_TEMPLATE_IDS.CcListing, listingCid, "Listing_Attest", {
    holdingCids: [...a.holdingCids],
    allowanceCids: [...a.allowanceCids],
    previous: a.previous,
  } satisfies Wire<Cc.PM.CC.Listing.Listing_Attest>);

export const setDeposits = (listingCid: ContractId, open: boolean): Command =>
  exercise(CC_TEMPLATE_IDS.CcListing, listingCid, "Listing_SetDeposits", { open } satisfies Wire<Cc.PM.CC.Listing.Listing_SetDeposits>);

export interface ListingInput {
  venue: Party;
  auditor: Party;
  listingId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  unitsPerCoin: bigint;
  minDepositUnits: bigint;
  maxDepositUnits: bigint;
  depositsOpen: boolean;
}

export const createListing = (l: ListingInput): Command =>
  create(CC_TEMPLATE_IDS.CcListing, {
    venue: l.venue,
    auditor: l.auditor,
    listingId: l.listingId,
    instrumentAdmin: l.instrumentAdmin,
    instrumentId: l.instrumentId,
    unitsPerCoin: toDamlInt(l.unitsPerCoin),
    minDepositUnits: toDamlInt(l.minDepositUnits),
    maxDepositUnits: toDamlInt(l.maxDepositUnits),
    depositsOpen: l.depositsOpen,
  } satisfies Wire<Listing>);

// ---- the seat ----------------------------------------------------------------------------------------

/**
 * The seat's ask: `units` of its cash back in coin, under the terms it saw (listing id, instrument, rate) and standing
 * until `validUntilSec`. A plain create signed by the owner; the venue answers it. The terms are what stops a venue that
 * re-creates a listing under the same id with another rate from answering it.
 */
export const createWithdrawProposal = (p: {
  owner: Party;
  venue: Party;
  listingId: string;
  instrumentAdmin: Party;
  instrumentId: string;
  unitsPerCoin: bigint;
  units: bigint;
  validUntilSec: number;
  ref: string;
}): Command =>
  create(CC_TEMPLATE_IDS.CcWithdrawProposal, {
    owner: p.owner,
    venue: p.venue,
    listingId: p.listingId,
    instrumentAdmin: p.instrumentAdmin,
    instrumentId: p.instrumentId,
    unitsPerCoin: toDamlInt(p.unitsPerCoin),
    units: toDamlInt(p.units),
    "validUntil": isoOfSec(p.validUntilSec),
    ref: p.ref,
  } satisfies Wire<Cc.PM.CC.Withdraw.CcWithdrawProposal>);

export const cancelWithdrawProposal = (proposalCid: ContractId): Command =>
  exercise(CC_TEMPLATE_IDS.CcWithdrawProposal, proposalCid, "Proposal_Cancel", {} satisfies Wire<Cc.PM.CC.Withdraw.Proposal_Cancel>);

/** The metadata key a transfer carries the rail's reference under (`refMetaKey` in Daml). */
export const REF_META_KEY = "abu-pm.io/ref";

/**
 * The seat's deposit: a token-standard transfer of `amountAtomic` from the seat to the venue, carrying the registry's
 * choice context and disclosed contracts. Two-step by default: it stays a `TransferInstruction` pending the venue's
 * acceptance, which `settleDeposit` gives together with the credit. The factory is exercised by INTERFACE id, so any
 * registry's factory works (Canton Coin's, or another CIP-56 instrument the venue lists).
 */
export interface TransferArgs {
  sender: Party;
  receiver: Party;
  instrumentAdmin: Party;
  instrumentId: string;
  amountAtomic: bigint;
  requestedAtSec: number;
  executeBeforeSec: number;
  inputHoldingCids: readonly ContractId[];
  ref: string;
}

/**
 * The `TransferFactory_Transfer` choice argument, with the empty extra args the registry's factory endpoint asks for
 * (`GetFactoryRequest.choiceArguments`: "the choice arguments ... with `extraArgs.context` and `extraArgs.meta` set to
 * the empty object"). The same argument, with the answer's context, is what the seat or the venue then submits.
 */
export function transferChoiceArguments(a: TransferArgs, context: RegistryContext | null = null) {
  return {
    expectedAdmin: a.instrumentAdmin,
    transfer: {
      sender: a.sender,
      receiver: a.receiver,
      amount: atomicToCc(a.amountAtomic),
      instrumentId: { admin: a.instrumentAdmin, id: a.instrumentId },
      requestedAt: isoOfSec(a.requestedAtSec),
      executeBefore: isoOfSec(a.executeBeforeSec),
      inputHoldingCids: [...a.inputHoldingCids],
      meta: { values: { [REF_META_KEY]: a.ref } },
    },
    extraArgs: extraArgsOf(context),
  };
}

export function instructDeposit(a: TransferArgs & { factoryCid: ContractId; context: RegistryContext | null }): Command {
  return exercise(CIP56_INTERFACE_IDS.TransferFactory, a.factoryCid, "TransferFactory_Transfer", transferChoiceArguments(a, a.context));
}

/** The owner accepts a transfer the venue sent (the withdrawal's second step): by interface id, with the registry's context. */
export const acceptTransfer = (instructionCid: ContractId, context: RegistryContext | null): Command =>
  exercise(CIP56_INTERFACE_IDS.TransferInstruction, instructionCid, "TransferInstruction_Accept", { extraArgs: extraArgsOf(context) });
