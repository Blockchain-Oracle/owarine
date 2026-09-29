/**
 * Ledger commands for abu-pm-agents (C8f) and the grant choices of abu-pm-main, one builder per choice. Who submits
 * each is fixed by its controller, and every builder says so:
 *
 *   venue        the standing offers a seat needs (`GrantDesk`, `DeskOffer`, `SubscriberInvite`, `CreatorLicense`),
 *                the aggregate creator payout
 *   owner/seat   grants (open, top up, revoke), the subscriber book, subscribe/unsubscribe, publishing and the
 *                creator's lifecycle, the desk's owner controls, a payout claim
 *   agent        `Grant_AcceptQuote` (the strategy runner and the X executor act through the owner's grant)
 *   operator     `Mandate_Trade`, `Mandate_Sell`, `Mandate_Checkpoint`, `Mandate_Pause`
 *   attestor     `DeskMark` (an oracle party's mark of one market's side)
 *
 * Same Daml-LF JSON encoding as `../canton/commands.ts`: Int as a decimal string, Time as ISO-8601, enums as their
 * constructor name, Optional as the value or null. Templates are named by package name, so a compatible upgrade of
 * either package never changes a caller.
 */
import { AGENT_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import { toDamlInt, type Command, type ContractId, type Party } from "@agari/ledger/pure";
import { isoOfSec, type Side } from "../canton/decode";
import type { DeskModeC, EnvelopeC, GrantCapsC, SubKindC } from "./decode";

// Daml field names that are Times (`"asOf"`, `"deadline"`) are quoted so the time-suffix rule reads them as such.
const exercise = (templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});
const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });
const int = (v: bigint | number) => toDamlInt(BigInt(v));
const A = AGENT_TEMPLATE_IDS;

const caps = (c: GrantCapsC) => ({
  maxStakePerTrade: int(c.maxStakePerTrade), maxDailySpend: int(c.maxDailySpend), maxPriceTicks: int(c.maxPriceTicks), maxOpenPositions: int(c.maxOpenPositions),
});
const envelope = (e: EnvelopeC) => ({
  maxStakePerTrade: int(e.maxStakePerTrade), maxDailySpend: int(e.maxDailySpend), maxOpenPositions: int(e.maxOpenPositions), maxPriceTicks: int(e.maxPriceTicks),
});

// ---- venue: the standing offers --------------------------------------------------------------------

export const createGrantDesk = (venue: Party, owner: Party): Command => create(A.GrantDesk, { venue, owner });
export const createDeskOffer = (venue: Party, owner: Party): Command => create(A.DeskOffer, { venue, owner });
export const createSubscriberInvite = (venue: Party, subscriber: Party): Command => create(A.SubscriberInvite, { venue, subscriber });
export const createCreatorLicense = (venue: Party, creator: Party): Command => create(A.CreatorLicense, { venue, creator, nextIndex: int(0) });

/** Venue: every fee passed must be this licence's creator's; the payout carries a total and a count only. */
export const payout = (licenseCid: ContractId, feeCids: readonly ContractId[], period: number): Command =>
  exercise(A.CreatorLicense, licenseCid, "License_Payout", { feeCids: [...feeCids], period: int(period) });

// ---- owner: grants ---------------------------------------------------------------------------------

export interface OpenGrantInput {
  agent: Party;
  caps: GrantCapsC;
  expiresAtSec: number;
  /** Start of the grant's day 0 (UTC midnight of the opening day: the reference's cap clock). */
  dayZeroSec: number;
  budget: bigint;
  cash: readonly ContractId[];
}

/** Owner: a grant funded from the owner's own cash; change comes back. */
export const openGrant = (grantDeskCid: ContractId, g: OpenGrantInput): Command =>
  exercise(A.GrantDesk, grantDeskCid, "GrantDesk_Open", {
    agent: g.agent, caps: caps(g.caps), expiresAt: isoOfSec(g.expiresAtSec), dayZero: isoOfSec(g.dayZeroSec), budget: int(g.budget), cash: [...g.cash],
  });

/** Owner: add cash to a live grant; day, spend, positions, caps and expiry are kept. */
export const fundGrant = (grantDeskCid: ContractId, grantCid: ContractId, cash: readonly ContractId[]): Command =>
  exercise(A.GrantDesk, grantDeskCid, "GrantDesk_Fund", { grantCid, cash: [...cash] });

/** Owner: the budget comes back as cash, expired or not. */
export const revokeGrant = (grantCid: ContractId): Command => exercise(TEMPLATE_IDS.AgentGrant, grantCid, "Grant_Revoke", {});

/** Agent: accept one of the owner's quotes at or under `limitTicks`, the agent's clock at `asOfSec`. */
export const acceptQuoteFor = (grantCid: ContractId, quoteCid: ContractId, limitTicks: number, asOfSec: number): Command =>
  exercise(TEMPLATE_IDS.AgentGrant, grantCid, "Grant_AcceptQuote", { quoteCid, limitTicks: int(limitTicks), "asOf": isoOfSec(asOfSec) });

// ---- the strategy registry -------------------------------------------------------------------------

export interface PublishInput {
  runner: Party;
  envelope: EnvelopeC;
  fee: bigint;
  /** The whole published text; `specHash` is its SHA-256, lowercase hex (Daml `DA.Text.sha256`). */
  spec: string;
  specHash: string;
}

/** Creator: seal and list a strategy (the licence's next index names it). */
export const publishStrategy = (licenseCid: ContractId, p: PublishInput): Command =>
  exercise(A.CreatorLicense, licenseCid, "License_Publish", { runner: p.runner, envelope: envelope(p.envelope), fee: int(p.fee), spec: p.spec, specHash: p.specHash });

/** Creator: a new spec revision or fee; the envelope and the subscriptions on record stay. */
export const updateStrategy = (strategyCid: ContractId, listingCid: ContractId, spec: string, specHash: string, fee: bigint): Command =>
  exercise(A.Strategy, strategyCid, "Strategy_Update", { newSpec: spec, newSpecHash: specHash, newFee: int(fee), listingCid });

/** Creator: rotate the runner; subscribers re-grant to follow. */
export const setRunner = (strategyCid: ContractId, listingCid: ContractId, runner: Party): Command =>
  exercise(A.Strategy, strategyCid, "Strategy_SetRunner", { newRunner: runner, listingCid });

/** Creator: stop taking subscribers. */
export const deactivateStrategy = (strategyCid: ContractId, listingCid: ContractId): Command =>
  exercise(A.Strategy, strategyCid, "Strategy_Deactivate", { listingCid });

/** Subscriber: open the book of consents from the venue's invitation. */
export const openBook = (inviteCid: ContractId): Command => exercise(A.SubscriberInvite, inviteCid, "Invite_OpenBook", {});

export interface SubscribeInput {
  listingCid: ContractId;
  grantCid: ContractId;
  kind: SubKindC;
  maxFee: bigint;
  expectVersion: number;
  cash: readonly ContractId[];
}

/** Subscriber: consent to be traded for, through the subscriber's own grant to the strategy's runner. */
export const subscribe = (bookCid: ContractId, s: SubscribeInput): Command =>
  exercise(A.SubscriberBook, bookCid, "Subscriber_Subscribe", {
    listingCid: s.listingCid, grantCid: s.grantCid, kind: s.kind, maxFee: int(s.maxFee), expectVersion: int(s.expectVersion), cash: [...s.cash],
  });

/** Subscriber: end a consent (revoking the grant is what stops the runner). */
export const unsubscribe = (bookCid: ContractId, subscriptionCid: ContractId): Command =>
  exercise(A.SubscriberBook, bookCid, "Subscriber_Unsubscribe", { subscriptionCid });

/** Creator: turn a period's aggregate payout into cash. */
export const claimPayout = (payoutCid: ContractId): Command => exercise(A.CreatorPayout, payoutCid, "Payout_Claim", {});

// ---- the desk ---------------------------------------------------------------------------------------

export interface OpenDeskInput {
  operator: Party;
  caps: GrantCapsC;
  expiresAtSec: number;
  dayZeroSec: number;
  budget: bigint;
  cash: readonly ContractId[];
  allowList: readonly string[];
  maxPremiumBps: number;
  attestors: readonly Party[];
  refQuorum: number;
  mode: DeskModeC;
}

/** Owner: open the desk, funded from the owner's cash (change comes back). */
export const openDesk = (offerCid: ContractId, d: OpenDeskInput): Command =>
  exercise(A.DeskOffer, offerCid, "DeskOffer_Open", {
    operator: d.operator, caps: caps(d.caps), expiresAt: isoOfSec(d.expiresAtSec), dayZero: isoOfSec(d.dayZeroSec), budget: int(d.budget), cash: [...d.cash],
    allowList: [...d.allowList], maxPremiumBps: int(d.maxPremiumBps), attestors: [...d.attestors], refQuorum: int(d.refQuorum), mode: d.mode,
  });

const M = (cid: ContractId, choice: string, arg: unknown = {}) => exercise(A.DeskMandate, cid, choice, arg);

/** Owner or operator. */
export const pauseDesk = (mandateCid: ContractId, actor: Party): Command => M(mandateCid, "Mandate_Pause", { actor });
/** Owner. */
export const unpauseDesk = (mandateCid: ContractId): Command => M(mandateCid, "Mandate_Unpause");
export const setDeskMode = (mandateCid: ContractId, mode: DeskModeC): Command => M(mandateCid, "Mandate_SetMode", { newMode: mode });
export const setDeskLimits = (mandateCid: ContractId, c: GrantCapsC, maxPremiumBps: number): Command =>
  M(mandateCid, "Mandate_SetLimits", { newCaps: caps(c), newMaxPremiumBps: int(maxPremiumBps) });
export const setDeskAllowList = (mandateCid: ContractId, allowList: readonly string[]): Command => M(mandateCid, "Mandate_SetAllowList", { newAllowList: [...allowList] });
export const setDeskOperator = (mandateCid: ContractId, operator: Party): Command => M(mandateCid, "Mandate_SetOperator", { newOperator: operator });
export const revokeDeskOperator = (mandateCid: ContractId): Command => M(mandateCid, "Mandate_RevokeOperator");
export const depositDesk = (mandateCid: ContractId, cash: readonly ContractId[]): Command => M(mandateCid, "Mandate_Deposit", { cash: [...cash] });
export const withdrawDesk = (mandateCid: ContractId, amount: bigint): Command => M(mandateCid, "Mandate_Withdraw", { amount: int(amount) });
export const closeDesk = (mandateCid: ContractId): Command => M(mandateCid, "Mandate_Close");

export interface DeskSealInput {
  actor: Party;
  /** The head this decision builds on (64 hex, no `0x`). */
  prevHead: string;
  /** The record's hash (64 hex, no `0x`, never zero). */
  decisionHash: string;
  note: string;
}

/** Operator: buy one of the owner's quotes inside the mandate. */
export const deskTrade = (mandateCid: ContractId, s: DeskSealInput & { quoteCid: ContractId; limitTicks: number; asOfSec: number; markCids: readonly ContractId[] }): Command =>
  M(mandateCid, "Mandate_Trade", {
    actor: s.actor, quoteCid: s.quoteCid, limitTicks: int(s.limitTicks), "asOf": isoOfSec(s.asOfSec), markCids: [...s.markCids],
    prevHead: s.prevHead, decisionHash: s.decisionHash, note: s.note,
  });

/** Operator: sell lots the desk holds back to the venue on a buy-back quote. */
export const deskSell = (mandateCid: ContractId, s: DeskSealInput & { buyQuoteCid: ContractId; asOfSec: number; markCids: readonly ContractId[] }): Command =>
  M(mandateCid, "Mandate_Sell", {
    actor: s.actor, buyQuoteCid: s.buyQuoteCid, "asOf": isoOfSec(s.asOfSec), markCids: [...s.markCids], prevHead: s.prevHead, decisionHash: s.decisionHash, note: s.note,
  });

/** Operator: seal a non-action ("looked, did nothing", a shadow decision, the daily checkpoint). */
export const deskCheckpoint = (mandateCid: ContractId, s: DeskSealInput & { deadlineSec: number }): Command =>
  M(mandateCid, "Mandate_Checkpoint", { actor: s.actor, prevHead: s.prevHead, decisionHash: s.decisionHash, "deadline": isoOfSec(s.deadlineSec), note: s.note });

/** Attestor: one mark of one market's side, in ticks. */
export const createDeskMark = (m: { attestor: Party; venue: Party; marketId: string; side: Side; refTicks: number; fetchedAtSec: number }): Command =>
  create(A.DeskMark, { attestor: m.attestor, venue: m.venue, marketId: m.marketId, side: m.side, refTicks: int(m.refTicks), fetchedAt: isoOfSec(m.fetchedAtSec) });

/** Attestor: retire a stale mark. */
export const archiveDeskMark = (markCid: ContractId): Command => exercise(A.DeskMark, markCid, "Archive", {});
