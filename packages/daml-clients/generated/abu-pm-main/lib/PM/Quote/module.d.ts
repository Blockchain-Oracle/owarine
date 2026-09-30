// Generated from ../../PM/Quote/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Leg from '../../PM/Leg/module';
import * as PM_Market from '../../PM/Market/module';
import * as PM_Money from '../../PM/Money/module';
import * as PM_Types from '../../PM/Types/module';

export declare type BuyQuote = {
  venue: damlTypes.Party,
  user: damlTypes.Party,
  legCid: damlTypes.ContractId<PM_Leg.Leg>,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  pairId: string,
  outcome: PM_Types.Side,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  priceTicks: damlTypes.Int,
  locked: damlTypes.Int,
  validUntil: damlTypes.Time,
  book: damlTypes.Optional<string>,
}

export declare interface BuyQuoteInterface {
  Archive: 
    damlTypes.Choice<BuyQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BuyQuote, undefined>>;
  BuyQuote_Accept: 
    damlTypes.Choice<BuyQuote, BuyQuote_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<PM_Money.VenueCash>, damlTypes.ContractId<PM_Leg.Leg>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BuyQuote, undefined>>;
  BuyQuote_Expire: 
    damlTypes.Choice<BuyQuote, BuyQuote_Expire, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BuyQuote, undefined>>;
  BuyQuote_Withdraw: 
    damlTypes.Choice<BuyQuote, BuyQuote_Withdraw, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BuyQuote, undefined>>;
}
export declare const BuyQuote:
  damlTypes.Template<BuyQuote, undefined, '#abu-pm-main:PM.Quote:BuyQuote'> &
  damlTypes.ToInterface<BuyQuote, never> &
  BuyQuoteInterface

export declare type BuyQuote_Accept = {
}

export declare const BuyQuote_Accept:
  damlTypes.Serializable<BuyQuote_Accept>

export declare type BuyQuote_Expire = {
}

export declare const BuyQuote_Expire:
  damlTypes.Serializable<BuyQuote_Expire>

export declare type BuyQuote_Withdraw = {
  reason: string,
}

export declare const BuyQuote_Withdraw:
  damlTypes.Serializable<BuyQuote_Withdraw>

export declare type Desk_IssueBuyQuote = {
  shardCid: damlTypes.ContractId<PM_Money.VenueCash>,
  legCid: damlTypes.ContractId<PM_Leg.Leg>,
  priceTicks: damlTypes.Int,
  validUntil: damlTypes.Time,
  sellLots: damlTypes.Optional<damlTypes.Int>,
}

export declare const Desk_IssueBuyQuote:
  damlTypes.Serializable<Desk_IssueBuyQuote>

export declare type Desk_IssueQuote = {
  shardCid: damlTypes.ContractId<PM_Money.VenueCash>,
  user: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  pairId: string,
  side: PM_Types.Side,
  priceTicks: damlTypes.Int,
  lots: damlTypes.Int,
  fee: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Desk_IssueQuote:
  damlTypes.Serializable<Desk_IssueQuote>

export declare type Desk_IssueTwoWay = {
  shardCid: damlTypes.ContractId<PM_Money.VenueCash>,
  user: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  buyPairId: string,
  sellPairId: string,
  bidTicks: damlTypes.Int,
  askTicks: damlTypes.Int,
  lots: damlTypes.Int,
  buyFee: damlTypes.Int,
  sellFee: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Desk_IssueTwoWay:
  damlTypes.Serializable<Desk_IssueTwoWay>

export declare type Desk_SettleBatch = {
  legCids: damlTypes.ContractId<PM_Leg.Leg>[],
  resolutionCid: damlTypes.ContractId<PM_Market.Resolution>,
}

export declare const Desk_SettleBatch:
  damlTypes.Serializable<Desk_SettleBatch>

export declare type Quote = {
  venue: damlTypes.Party,
  user: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  pairId: string,
  side: PM_Types.Side,
  priceTicks: damlTypes.Int,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  fee: damlTypes.Int,
  validUntil: damlTypes.Time,
  lockAt: damlTypes.Time,
  refundAfter: damlTypes.Time,
  book: damlTypes.Optional<string>,
}

export declare interface QuoteInterface {
  Archive: 
    damlTypes.Choice<Quote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Quote, undefined>>;
  Quote_Accept: 
    damlTypes.Choice<Quote, Quote_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<PM_Leg.Leg>, damlTypes.ContractId<PM_Leg.Leg>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Quote, undefined>>;
  Quote_Expire: 
    damlTypes.Choice<Quote, Quote_Expire, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Quote, undefined>>;
  Quote_Withdraw: 
    damlTypes.Choice<Quote, Quote_Withdraw, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Quote, undefined>>;
}
export declare const Quote:
  damlTypes.Template<Quote, undefined, '#abu-pm-main:PM.Quote:Quote'> &
  damlTypes.ToInterface<Quote, never> &
  QuoteInterface

export declare type Quote_Accept = {
  cash: damlTypes.ContractId<PM_Money.VenueCash>[],
  beneficiaryRef: damlTypes.Optional<string>,
}

export declare const Quote_Accept:
  damlTypes.Serializable<Quote_Accept>

export declare type Quote_Expire = {
}

export declare const Quote_Expire:
  damlTypes.Serializable<Quote_Expire>

export declare type Quote_Withdraw = {
  reason: string,
}

export declare const Quote_Withdraw:
  damlTypes.Serializable<Quote_Withdraw>

export declare type SettleBatchResult = {
  payouts: damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>[],
  fees: damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>,
}

export declare const SettleBatchResult:
  damlTypes.Serializable<SettleBatchResult>

export declare type VenueDesk = {
  venue: damlTypes.Party,
}

export declare interface VenueDeskInterface {
  Archive: 
    damlTypes.Choice<VenueDesk, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueDesk, undefined>>;
  Desk_IssueBuyQuote: 
    damlTypes.Choice<VenueDesk, Desk_IssueBuyQuote, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<BuyQuote>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueDesk, undefined>>;
  Desk_IssueQuote: 
    damlTypes.Choice<VenueDesk, Desk_IssueQuote, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<Quote>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueDesk, undefined>>;
  Desk_IssueTwoWay: 
    damlTypes.Choice<VenueDesk, Desk_IssueTwoWay, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<Quote>, damlTypes.ContractId<Quote>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueDesk, undefined>>;
  Desk_SettleBatch: 
    damlTypes.Choice<VenueDesk, Desk_SettleBatch, SettleBatchResult, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueDesk, undefined>>;
}
export declare const VenueDesk:
  damlTypes.Template<VenueDesk, undefined, '#abu-pm-main:PM.Quote:VenueDesk'> &
  damlTypes.ToInterface<VenueDesk, never> &
  VenueDeskInterface
