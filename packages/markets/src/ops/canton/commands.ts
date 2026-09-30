/**
 * Ledger commands for the venue actors, one builder per abu-pm-main choice they exercise. Arguments are typed by the
 * generated bindings (`@agari/daml`), encoded as Daml-LF JSON: Int as a decimal string, Time as ISO-8601, enums as
 * their constructor name, variants as `{ tag, value }`. Templates are named by package name (`#abu-pm-main:…`), so a
 * compatible upgrade of the package never changes an actor.
 */
import { TEMPLATE_IDS, type PM } from "@agari/daml";
import { toDamlInt, type Command, type ContractId, type Party } from "@agari/ledger/pure";
import { isoOfSec, type Side } from "./decode";

const exercise = (templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});
const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });
const int = (v: bigint | number) => toDamlInt(BigInt(v));

/** A generated payload type with every branded string (ContractId) as plain text, which is what the wire carries. */
type Wire<T> = T extends string ? string : T extends readonly (infer U)[] ? Wire<U>[] : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;

// ---- series and windows ------------------------------------------------------------------------

export const openWindow = (seriesCid: ContractId, index: number): Command =>
  exercise(TEMPLATE_IDS.Series, seriesCid, "Series_OpenWindow", { index: int(index) } satisfies Wire<PM.Series.Series_OpenWindow>);

/**
 * abu-pm-main 0.4.0 (K-030): a Window with its own boundaries, for a lane that cannot sit on the Series' grid (the
 * Monday Gap: Friday close → Monday open, locking Sunday 20:00 ET). Same index, overlap and policy checks as
 * `openWindow`; refusals `bad-span`, `span-too-long`, `window-overlap`, `no-policy`, `bad-window-index`.
 */
export const openWindowSpan = (seriesCid: ContractId, w: { index: number; tradingStartSec: number; lockAtSec: number; expirySec: number }): Command =>
  exercise(TEMPLATE_IDS.Series, seriesCid, "Series_OpenWindowSpan", {
    index: int(w.index), "tradingStart": isoOfSec(w.tradingStartSec), lockAt: isoOfSec(w.lockAtSec), "expiry": isoOfSec(w.expirySec),
  } satisfies Wire<PM.Series.Series_OpenWindowSpan>);

/** 0.4.0: a committee yes/no event as the Series' next Window (`MarketTerms` + `EventTerms` + `EventState`, no `WindowState`). */
export const openEvent = (seriesCid: ContractId, e: { index: number; question: string; tradingStartSec: number; lockAtSec: number; closeTimeSec: number }): Command =>
  exercise(TEMPLATE_IDS.Series, seriesCid, "Series_OpenEvent", {
    index: int(e.index), question: e.question, "tradingStart": isoOfSec(e.tradingStartSec), lockAt: isoOfSec(e.lockAtSec), closeTime: isoOfSec(e.closeTimeSec),
  } satisfies Wire<PM.Series.Series_OpenEvent>);

export const skipTo = (seriesCid: ContractId, toIndex: number): Command =>
  exercise(TEMPLATE_IDS.Series, seriesCid, "Series_SkipTo", { toIndex: int(toIndex) } satisfies Wire<PM.Series.Series_SkipTo>);

export interface SeriesInput {
  venue: Party;
  resolver: Party;
  auditor: Party;
  seriesKey: string;
  symbol: string;
  anchorSec: number;
  cadenceSec: number;
  lockLeadSec: number;
  settleGraceSec: number;
  cashUnit: bigint;
  nextIndex: number;
  oracles: Party[];
  quorum: number;
  maxDeviationBps: number;
  policy: PolicyInput;
  /** Dated later versions, oldest first (C6: TSLA's Pyth version ends at the trial and RedStone takes over). */
  laterPolicies?: PolicyInput[];
}

export interface PolicyInput {
  version: number;
  effectiveFromSec: number;
  /** The version's end (`validUntil`); null or absent is open-ended. */
  validUntilSec?: number | null;
  printSource: string;
  minDelaySec: number;
  barLenSec: number;
  /** Negative: admit the open print until `lockAt`. */
  openAdmissionSec: number;
  closeAdmissionSec: number;
}

const policyVersion = (p: PolicyInput) => ({
  version: int(p.version), effectiveFrom: isoOfSec(p.effectiveFromSec), validUntil: p.validUntilSec == null ? null : isoOfSec(p.validUntilSec), printSource: p.printSource,
  minDelaySec: int(p.minDelaySec), barLenSec: int(p.barLenSec), openAdmissionSec: int(p.openAdmissionSec), closeAdmissionSec: int(p.closeAdmissionSec),
});

/** A new cadence lane (bootstrap only; a live Series is only ever consumed by `Series_OpenWindow` and friends). */
export const createSeries = (s: SeriesInput): Command =>
  create(TEMPLATE_IDS.Series, {
    venue: s.venue, resolver: s.resolver, auditor: s.auditor, seriesKey: s.seriesKey, symbol: s.symbol,
    anchor: isoOfSec(s.anchorSec), cadenceSec: int(s.cadenceSec), lockLeadSec: int(s.lockLeadSec), settleGraceSec: int(s.settleGraceSec),
    cashUnit: int(s.cashUnit), nextIndex: int(s.nextIndex), oracles: s.oracles, quorum: int(s.quorum), maxDeviationBps: int(s.maxDeviationBps),
    policyVersions: [s.policy, ...(s.laterPolicies ?? [])].map(policyVersion),
    // abu-pm-main 0.4.0: a new Series has opened no Window yet.
    lastExpiry: null,
  } satisfies Wire<PM.Series.Series>);

// ---- oracle prints -----------------------------------------------------------------------------

export interface PriceQuoteInput {
  oracle: Party;
  venue: Party;
  resolver: Party;
  symbol: string;
  boundarySec: number;
  priceE8: bigint;
  barLenSec: number;
  fetchedAtSec: number;
  payloadHash: string;
  policyVersion: number;
}

export const createPriceQuote = (q: PriceQuoteInput): Command =>
  create(TEMPLATE_IDS.PriceQuote, {
    oracle: q.oracle, venue: q.venue, resolver: q.resolver, symbol: q.symbol,
    boundaryT: isoOfSec(q.boundarySec), priceE8: int(q.priceE8), barStart: isoOfSec(q.boundarySec - q.barLenSec),
    barLenSec: int(q.barLenSec), fetchedAt: isoOfSec(q.fetchedAtSec), payloadHash: q.payloadHash, policyVersion: int(q.policyVersion),
  } satisfies Wire<PM.Oracle.PriceQuote>);

export const retirePriceQuote = (cid: ContractId): Command => exercise(TEMPLATE_IDS.PriceQuote, cid, "PriceQuote_Retire", {});

// ---- resolution (the resolver's three choices) --------------------------------------------------

export const recordOpen = (termsCid: ContractId, stateCid: ContractId, quoteCids: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.MarketTerms, termsCid, "Terms_RecordOpen", { stateCid, quoteCids: [...quoteCids] } satisfies Wire<PM.Market.Terms_RecordOpen>);

export const resolve = (termsCid: ContractId, openCid: ContractId, quoteCids: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.MarketTerms, termsCid, "Terms_Resolve", { openCid, quoteCids: [...quoteCids] } satisfies Wire<PM.Market.Terms_Resolve>);

export type VoidStageInput = { tag: "BeforeOpen"; stateCid: ContractId } | { tag: "AfterOpen"; openCid: ContractId };

export function voidTerms(termsCid: ContractId, stage: VoidStageInput, quoteCids: readonly ContractId[]): Command {
  const encoded: Wire<PM.Market.VoidStage> =
    stage.tag === "BeforeOpen" ? { tag: "BeforeOpen", value: { stateCid: stage.stateCid } } : { tag: "AfterOpen", value: { openCid: stage.openCid } };
  return exercise(TEMPLATE_IDS.MarketTerms, termsCid, "Terms_Void", { stage: encoded, quoteCids: [...quoteCids] } satisfies Wire<PM.Market.Terms_Void>);
}

// ---- committee events (0.4.0) ------------------------------------------------------------------

export interface EventAttestationInput {
  attestor: Party;
  venue: Party;
  resolver: Party;
  marketId: string;
  answer: boolean;
  attestedAtSec: number;
  /** sha-256 hex of the member's full statement (core `eventStatementHash`). */
  statementHash: string;
}

/** One committee member's YES/NO, signed by that member alone. */
export const createEventAttestation = (a: EventAttestationInput): Command =>
  create(TEMPLATE_IDS.EventAttestation, {
    attestor: a.attestor, venue: a.venue, resolver: a.resolver, marketId: a.marketId, answer: a.answer,
    attestedAt: isoOfSec(a.attestedAtSec), statementHash: a.statementHash,
  } satisfies Wire<PM.Event.EventAttestation>);

/** The resolver's `Event_Resolve`: a counted quorum, unanimous → Up (YES) / Down (NO), mixed → SourceDisagreement void. */
export const resolveEvent = (eventCid: ContractId, stateCid: ContractId, attestationCids: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.EventTerms, eventCid, "Event_Resolve", { stateCid, attestationCids: [...attestationCids] } satisfies Wire<PM.Event.Event_Resolve>);

/** The resolver's `Event_Void` after the close deadline; the attestations offered only name the reason. */
export const voidEvent = (eventCid: ContractId, stateCid: ContractId, attestationCids: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.EventTerms, eventCid, "Event_Void", { stateCid, attestationCids: [...attestationCids] } satisfies Wire<PM.Event.Event_Void>);

export const retireAttestation = (cid: ContractId): Command => exercise(TEMPLATE_IDS.EventAttestation, cid, "Attestation_Retire", {});

// ---- the desk: quotes and settlement -----------------------------------------------------------

export interface IssueQuoteInput {
  shardCid: ContractId;
  user: Party;
  termsCid: ContractId;
  pairId: string;
  side: Side;
  priceTicks: number;
  lots: bigint;
  fee: bigint;
  validUntilSec: number;
}

export const issueQuote = (deskCid: ContractId, q: IssueQuoteInput): Command =>
  exercise(TEMPLATE_IDS.VenueDesk, deskCid, "Desk_IssueQuote", {
    shardCid: q.shardCid, user: q.user, termsCid: q.termsCid, pairId: q.pairId, side: q.side,
    priceTicks: int(q.priceTicks), lots: int(q.lots), fee: int(q.fee), validUntil: isoOfSec(q.validUntilSec),
  } satisfies Wire<PM.Quote.Desk_IssueQuote>);

export interface IssueBuyQuoteInput {
  shardCid: ContractId;
  legCid: ContractId;
  priceTicks: number;
  validUntilSec: number;
  /** Lots of the leg to buy back; null buys the whole leg. */
  sellLots: bigint | null;
}

/** The venue's firm offer to buy back part or all of a user's leg (C7a exit), locking the price from a shard. */
export const issueBuyQuote = (deskCid: ContractId, q: IssueBuyQuoteInput): Command =>
  exercise(TEMPLATE_IDS.VenueDesk, deskCid, "Desk_IssueBuyQuote", {
    shardCid: q.shardCid, legCid: q.legCid, priceTicks: int(q.priceTicks), validUntil: isoOfSec(q.validUntilSec),
    sellLots: q.sellLots === null ? null : int(q.sellLots),
  } satisfies Wire<PM.Quote.Desk_IssueBuyQuote>);

export const expireBuyQuote = (buyQuoteCid: ContractId): Command => exercise(TEMPLATE_IDS.BuyQuote, buyQuoteCid, "BuyQuote_Expire", {});

export const withdrawBuyQuote = (buyQuoteCid: ContractId, reason: string): Command =>
  exercise(TEMPLATE_IDS.BuyQuote, buyQuoteCid, "BuyQuote_Withdraw", { reason } satisfies Wire<PM.Quote.BuyQuote_Withdraw>);

/** The user's own accept of a buy-back. Built for drive scripts and the web's server half; ops never submits it. */
export const acceptBuyQuote = (buyQuoteCid: ContractId): Command => exercise(TEMPLATE_IDS.BuyQuote, buyQuoteCid, "BuyQuote_Accept", {});

export const settleBatch = (deskCid: ContractId, resolutionCid: ContractId, legCids: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.VenueDesk, deskCid, "Desk_SettleBatch", { legCids: [...legCids], resolutionCid } satisfies Wire<PM.Quote.Desk_SettleBatch>);

export const expireQuote = (quoteCid: ContractId): Command => exercise(TEMPLATE_IDS.Quote, quoteCid, "Quote_Expire", {});

/** The user's own accept (single controller). Built here for drive scripts and the web's server half; ops never submits it. */
export const acceptQuote = (quoteCid: ContractId, cash: readonly ContractId[], beneficiaryRef: string | null = null): Command =>
  exercise(TEMPLATE_IDS.Quote, quoteCid, "Quote_Accept", { cash: [...cash], beneficiaryRef } satisfies Wire<PM.Quote.Quote_Accept>);

/** Two controllers (venue and owner): the seat drain's close-out at cost, re-backed from a venue shard. */
export const closeOutLeg = (legCid: ContractId, shardCid: ContractId): Command =>
  exercise(TEMPLATE_IDS.Leg, legCid, "Leg_CloseOut", { shardCid } satisfies Wire<PM.Leg.Leg_CloseOut>);

export const withdrawQuote = (quoteCid: ContractId, reason: string): Command =>
  exercise(TEMPLATE_IDS.Quote, quoteCid, "Quote_Withdraw", { reason } satisfies Wire<PM.Quote.Quote_Withdraw>);

export const settleResidual = (residualCid: ContractId, resolutionCid: ContractId): Command =>
  exercise(TEMPLATE_IDS.NettedResidual, residualCid, "Residual_Settle", { resolutionCid } satisfies Wire<PM.Leg.Residual_Settle>);

export const mergeLegs = (legCid: ContractId, otherCid: ContractId): Command =>
  exercise(TEMPLATE_IDS.Leg, legCid, "Leg_Merge", { otherCid } satisfies Wire<PM.Leg.Leg_Merge>);

// ---- cash ----------------------------------------------------------------------------------------

export const mergeCash = (cid: ContractId, others: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.VenueCash, cid, "VenueCash_Merge", { others: [...others] } satisfies Wire<PM.Money.VenueCash_Merge>);

export const splitCash = (cid: ContractId, take: bigint): Command =>
  exercise(TEMPLATE_IDS.VenueCash, cid, "VenueCash_Split", { take: int(take) } satisfies Wire<PM.Money.VenueCash_Split>);

/** A venue shard: `VenueCash` with owner = venue, which the venue alone signs. */
export const createShard = (venue: Party, amount: bigint, bucket = "shard"): Command =>
  create(TEMPLATE_IDS.VenueCash, { venue, owner: venue, amount: int(amount), bucket } satisfies Wire<PM.Money.VenueCash>);

export const createDesk = (venue: Party): Command => create(TEMPLATE_IDS.VenueDesk, { venue } satisfies Wire<PM.Quote.VenueDesk>);

// ---- seat accounts -------------------------------------------------------------------------------

export const inviteAccount = (venue: Party, owner: Party, label: string): Command =>
  create(TEMPLATE_IDS.VenueAccountInvite, { venue, owner, label } satisfies Wire<PM.Money.VenueAccountInvite>);

export const acceptInvite = (inviteCid: ContractId): Command => exercise(TEMPLATE_IDS.VenueAccountInvite, inviteCid, "Invite_Accept", {});

export const creditAccount = (accountCid: ContractId, amount: bigint, bucket = "demo"): Command =>
  exercise(TEMPLATE_IDS.VenueAccount, accountCid, "VenueAccount_Credit", { amount: int(amount), bucket } satisfies Wire<PM.Money.VenueAccount_Credit>);

// ---- the pre-open resting call (0.5.1, K-235) ------------------------------------------------------

/** The venue's desk for resting calls: created once (bootstrap or ops' first start), venue-only. */
export const createRestingDesk = (venue: Party): Command => create(TEMPLATE_IDS.RestingDesk, { venue } satisfies Wire<PM.Resting.RestingDesk>);

export interface OfferRestInput {
  owner: Party;
  termsCid: ContractId;
  callRef: string;
  side: Side;
  lots: bigint;
  /** The owner's own-side price in ticks of 1000. */
  priceTicks: number;
  expiresAtSec: number;
  validUntilSec: number;
}

/** The venue's offer to hold one call before the bell: the desk fetches the terms, so the offer carries the Window's own times and grid. */
export const offerRest = (deskCid: ContractId, o: OfferRestInput): Command =>
  exercise(TEMPLATE_IDS.RestingDesk, deskCid, "RestDesk_Offer", {
    owner: o.owner, termsCid: o.termsCid, callRef: o.callRef, side: o.side, lots: int(o.lots), priceTicks: int(o.priceTicks),
    expiresAt: isoOfSec(o.expiresAtSec), validUntil: isoOfSec(o.validUntilSec),
  } satisfies Wire<PM.Resting.RestDesk_Offer>);

/** `fillLots` of a call at exactly its own price, the venue's opposite stake locked from `shardCid`; the rest keeps resting. */
export const fillRest = (callCid: ContractId, f: { shardCid: ContractId; fillLots: bigint }): Command =>
  exercise(TEMPLATE_IDS.RestingCall, callCid, "Rest_Fill", { shardCid: f.shardCid, fillLots: int(f.fillLots) } satisfies Wire<PM.Resting.Rest_Fill>);

/** The venue's sweep of an unfilled call once its `expiresAt` has passed: the escrow of the lots still resting back to the owner. */
export const expireRest = (callCid: ContractId): Command => exercise(TEMPLATE_IDS.RestingCall, callCid, "Rest_Expire", {});

/** The owner's own cancel. Built for drive scripts and the web's server half; ops never submits it. */
export const cancelRest = (callCid: ContractId): Command => exercise(TEMPLATE_IDS.RestingCall, callCid, "Rest_Cancel", {});

/** The owner's own place of the venue's offer. Built for drive scripts and the web's server half; ops never submits it. */
export const placeRest = (offerCid: ContractId, cash: readonly ContractId[]): Command =>
  exercise(TEMPLATE_IDS.RestingOffer, offerCid, "RestOffer_Place", { cash: [...cash] } satisfies Wire<PM.Resting.RestOffer_Place>);

/** An offer nobody placed, swept once its window and slack are over. */
export const expireRestOffer = (offerCid: ContractId): Command => exercise(TEMPLATE_IDS.RestingOffer, offerCid, "RestOffer_Expire", {});
