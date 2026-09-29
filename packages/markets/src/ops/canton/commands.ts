/**
 * Ledger commands for the venue actors, one builder per abu-pm-main choice they exercise. Arguments are typed by the
 * generated bindings (`@agari/daml`), encoded as Daml-LF JSON: Int as a decimal string, Time as ISO-8601, enums as
 * their constructor name, variants as `{ tag, value }`. Templates are named by package name (`#abu-pm-main:…`), so a
 * compatible upgrade of the package never changes an actor.
 */
import { TEMPLATE_IDS, type PM } from "@agari/daml";
import { toDamlInt, type Command, type ContractId, type Party } from "@agari/ledger";
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
  policy: {
    version: number;
    effectiveFromSec: number;
    printSource: string;
    minDelaySec: number;
    barLenSec: number;
    /** Negative: admit the open print until `lockAt`. */
    openAdmissionSec: number;
    closeAdmissionSec: number;
  };
}

/** A new cadence lane (bootstrap only; a live Series is only ever consumed by `Series_OpenWindow` and friends). */
export const createSeries = (s: SeriesInput): Command =>
  create(TEMPLATE_IDS.Series, {
    venue: s.venue, resolver: s.resolver, auditor: s.auditor, seriesKey: s.seriesKey, symbol: s.symbol,
    anchor: isoOfSec(s.anchorSec), cadenceSec: int(s.cadenceSec), lockLeadSec: int(s.lockLeadSec), settleGraceSec: int(s.settleGraceSec),
    cashUnit: int(s.cashUnit), nextIndex: int(s.nextIndex), oracles: s.oracles, quorum: int(s.quorum), maxDeviationBps: int(s.maxDeviationBps),
    policyVersions: [
      {
        version: int(s.policy.version), effectiveFrom: isoOfSec(s.policy.effectiveFromSec), validUntil: null, printSource: s.policy.printSource,
        minDelaySec: int(s.policy.minDelaySec), barLenSec: int(s.policy.barLenSec),
        openAdmissionSec: int(s.policy.openAdmissionSec), closeAdmissionSec: int(s.policy.closeAdmissionSec),
      },
    ],
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
