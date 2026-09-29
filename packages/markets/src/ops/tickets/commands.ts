/**
 * Ledger commands for the ticket products (abu-pm-tickets) and their reserves (`PM.Reserve`), one builder per choice.
 * The venue's builders are what ops submits; the owner's (accept, claim, refund, supply, withdraw) are what the web's
 * server half submits as the leased seat's party only. Same Daml-LF JSON encoding as `../canton/commands.ts`.
 */
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import { toDamlInt, type Command, type ContractId, type Party } from "@agari/ledger";
import { isoOfSec, type Side } from "../canton/decode";
import type { ProductC, RangeKindC, RangeSideC, RiskParamsC } from "./decode";

const exercise = (templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown): Command => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
});
const create = (templateId: string, createArguments: unknown): Command => ({ CreateCommand: { templateId, createArguments } });
const int = (v: bigint | number) => toDamlInt(BigInt(v));
const T = TICKET_TEMPLATE_IDS;

const riskParams = (p: RiskParamsC) => ({
  maxExposureBps: int(p.maxExposureBps), maxPerTicket: int(p.maxPerTicket), maxPerExpiry: int(p.maxPerExpiry), maxLeverageBps: int(p.maxLeverageBps),
});

// ---- bootstrap -----------------------------------------------------------------------------------

export const createNavStatement = (o: { venue: Party; auditor: Party; reserveId: string; asOfSec: number }): Command =>
  create(TEMPLATE_IDS.NavStatement, { venue: o.venue, auditor: o.auditor, reserveId: o.reserveId, seq: int(0), asOf: isoOfSec(o.asOfSec), assets: int(0), shares: int(0) });

export const createRiskBook = (o: { venue: Party; reserveId: string; product: ProductC; params: RiskParamsC }): Command =>
  create(T.RiskBook, { venue: o.venue, reserveId: o.reserveId, product: o.product, params: riskParams(o.params), locked: [] });

export const createEarnDesk = (venue: Party): Command => create(T.EarnDesk, { venue });

// ---- the book: issuing ---------------------------------------------------------------------------

export interface IssueRangeInput {
  navCid: ContractId;
  shardCid: ContractId;
  user: Party;
  termsCid: ContractId;
  kind: RangeKindC;
  side: RangeSideC;
  lowE8: bigint;
  highE8: bigint;
  stake: bigint;
  maxPayout: bigint;
  validUntilSec: number;
}

export const issueRange = (bookCid: ContractId, q: IssueRangeInput): Command =>
  exercise(T.RiskBook, bookCid, "Book_IssueRange", {
    navCid: q.navCid, shardCid: q.shardCid, user: q.user, termsCid: q.termsCid, kind: q.kind, side: q.side,
    lowE8: int(q.lowE8), highE8: int(q.highE8), stake: int(q.stake), maxPayout: int(q.maxPayout), validUntil: isoOfSec(q.validUntilSec),
  });

export interface IssueBoostInput {
  navCid: ContractId;
  reserveShardCid: ContractId;
  houseShardCid: ContractId;
  user: Party;
  termsCid: ContractId;
  pairId: string;
  side: Side;
  priceTicks: number;
  lots: bigint;
  leverageBps: number;
  stake: bigint;
  fronted: bigint;
  premium: bigint;
  barrierE8: bigint;
  knockOutProceeds: bigint;
  validUntilSec: number;
}

export const issueBoost = (bookCid: ContractId, q: IssueBoostInput): Command =>
  exercise(T.RiskBook, bookCid, "Book_IssueBoost", {
    navCid: q.navCid, reserveShardCid: q.reserveShardCid, houseShardCid: q.houseShardCid, user: q.user, termsCid: q.termsCid, pairId: q.pairId,
    side: q.side, priceTicks: int(q.priceTicks), lots: int(q.lots), leverageBps: int(q.leverageBps), stake: int(q.stake), fronted: int(q.fronted),
    premium: int(q.premium), barrierE8: int(q.barrierE8), knockOutProceeds: int(q.knockOutProceeds), validUntil: isoOfSec(q.validUntilSec),
  });

export interface IssueParlayInput {
  navCid: ContractId;
  shardCid: ContractId;
  user: Party;
  picks: Array<{ termsCid: ContractId; side: Side }>;
  stake: bigint;
  maxPayout: bigint;
  validUntilSec: number;
}

export const issueParlay = (bookCid: ContractId, q: IssueParlayInput): Command =>
  exercise(T.RiskBook, bookCid, "Book_IssueParlay", {
    navCid: q.navCid, shardCid: q.shardCid, user: q.user, picks: q.picks.map((p) => ({ _1: p.termsCid, _2: p.side })),
    stake: int(q.stake), maxPayout: int(q.maxPayout), validUntil: isoOfSec(q.validUntilSec),
  });

export const pruneBook = (bookCid: ContractId, beforeSec: number): Command => exercise(T.RiskBook, bookCid, "Book_Prune", { before: isoOfSec(beforeSec) });

// ---- the venue's settlement, expiry and knock-out ---------------------------------------------------

export const settleRound = (roundCid: ContractId, resolutionCid: ContractId): Command => exercise(T.RangeRound, roundCid, "Round_Settle", { resolutionCid });
export const resolveParlayLeg = (ticketCid: ContractId, resolutionCid: ContractId): Command => exercise(T.ParlayTicket, ticketCid, "Ticket_ResolveLeg", { resolutionCid });
export const settleBoost = (positionCid: ContractId, resolutionCid: ContractId): Command => exercise(T.BoostPosition, positionCid, "Boost_Settle", { resolutionCid });

export const knockOutBoost = (positionCid: ContractId, o: { observedAtSec: number; quoteCids: readonly ContractId[]; shardCid: ContractId }): Command =>
  exercise(T.BoostPosition, positionCid, "Boost_KnockOut", { observedAt: isoOfSec(o.observedAtSec), quoteCids: [...o.quoteCids], shardCid: o.shardCid });

export const offerBoostExit = (positionCid: ContractId, o: { shardCid: ContractId; exitTicks: number; validUntilSec: number }): Command =>
  exercise(T.BoostPosition, positionCid, "Boost_OfferExit", { shardCid: o.shardCid, exitTicks: int(o.exitTicks), validUntil: isoOfSec(o.validUntilSec) });

export const expireRangeQuote = (cid: ContractId): Command => exercise(T.RangeQuote, cid, "RangeQuote_Expire", {});
export const expireParlayQuote = (cid: ContractId): Command => exercise(T.ParlayQuote, cid, "ParlayQuote_Expire", {});
export const expireBoostQuote = (cid: ContractId): Command => exercise(T.BoostQuote, cid, "BoostQuote_Expire", {});
export const expireBoostExit = (cid: ContractId): Command => exercise(T.BoostExitQuote, cid, "BoostExit_Expire", {});
export const withdrawBoostExit = (cid: ContractId, reason: string): Command => exercise(T.BoostExitQuote, cid, "BoostExit_Withdraw", { reason });
export const expireSupplyQuote = (cid: ContractId): Command => exercise(TEMPLATE_IDS.SupplyQuote, cid, "Supply_Expire", {});
export const expireWithdrawQuote = (cid: ContractId): Command => exercise(TEMPLATE_IDS.WithdrawQuote, cid, "Withdraw_Expire", {});

// ---- Earn: NAV and liquidity quotes --------------------------------------------------------------

export interface NavInputsC {
  cash: ContractId[];
  lpShares: ContractId[];
  withdrawQuotes: ContractId[];
  rangeQuotes: ContractId[];
  rounds: ContractId[];
  parlayQuotes: ContractId[];
  tickets: ContractId[];
  boostQuotes: ContractId[];
  positions: ContractId[];
}

export const publishNav = (earnDeskCid: ContractId, navCid: ContractId, asOfSec: number, inputs: NavInputsC): Command =>
  exercise(T.EarnDesk, earnDeskCid, "Earn_PublishNav", { navCid, asOf: isoOfSec(asOfSec), inputs });

export const issueSupply = (navCid: ContractId, o: { provider: Party; cashIn: bigint; validUntilSec: number }): Command =>
  exercise(TEMPLATE_IDS.NavStatement, navCid, "Nav_IssueSupply", { provider: o.provider, cashIn: int(o.cashIn), validUntil: isoOfSec(o.validUntilSec) });

export const issueWithdraw = (earnDeskCid: ContractId, o: { navCid: ContractId; provider: Party; lpShareCid: ContractId; sharesIn: bigint; shardCid: ContractId; validUntilSec: number }): Command =>
  exercise(T.EarnDesk, earnDeskCid, "Earn_IssueWithdraw", {
    navCid: o.navCid, provider: o.provider, lpShareCid: o.lpShareCid, sharesIn: int(o.sharesIn), shardCid: o.shardCid, validUntil: isoOfSec(o.validUntilSec),
  });

// ---- the owner's own choices (the web's server half and drive scripts; ops never submits these) -----

export const acceptRangeQuote = (cid: ContractId, cash: readonly ContractId[]): Command => exercise(T.RangeQuote, cid, "RangeQuote_Accept", { cash: [...cash] });
export const acceptParlayQuote = (cid: ContractId, cash: readonly ContractId[]): Command => exercise(T.ParlayQuote, cid, "ParlayQuote_Accept", { cash: [...cash] });
export const acceptBoostQuote = (cid: ContractId, cash: readonly ContractId[]): Command => exercise(T.BoostQuote, cid, "BoostQuote_Accept", { cash: [...cash] });
export const acceptBoostExit = (cid: ContractId): Command => exercise(T.BoostExitQuote, cid, "BoostExit_Accept", {});
export const claimRound = (cid: ContractId, resolutionCid: ContractId): Command => exercise(T.RangeRound, cid, "Round_Claim", { resolutionCid });
export const refundRound = (cid: ContractId): Command => exercise(T.RangeRound, cid, "Round_RefundStale", {});
export const claimParlayLeg = (cid: ContractId, resolutionCid: ContractId): Command => exercise(T.ParlayTicket, cid, "Ticket_ClaimLeg", { resolutionCid });
export const voidParlayStale = (cid: ContractId): Command => exercise(T.ParlayTicket, cid, "Ticket_VoidStale", {});
export const claimBoost = (cid: ContractId, resolutionCid: ContractId): Command => exercise(T.BoostPosition, cid, "Boost_Claim", { resolutionCid });
export const refundBoost = (cid: ContractId): Command => exercise(T.BoostPosition, cid, "Boost_RefundStale", {});
export const acceptSupply = (cid: ContractId, cash: readonly ContractId[]): Command => exercise(TEMPLATE_IDS.SupplyQuote, cid, "Supply_Accept", { cash: [...cash] });
export const acceptWithdraw = (cid: ContractId): Command => exercise(TEMPLATE_IDS.WithdrawQuote, cid, "Withdraw_Accept", {});
export const mergeLpShares = (cid: ContractId, otherCid: ContractId): Command => exercise(TEMPLATE_IDS.LpShare, cid, "LpShare_Merge", { otherCid });
