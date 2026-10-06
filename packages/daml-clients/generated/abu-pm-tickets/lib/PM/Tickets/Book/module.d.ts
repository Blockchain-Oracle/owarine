// Generated from ../../../PM/Tickets/Book/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a from '@daml.js/abu-pm-main-0.5.2';

import * as PM_Tickets_Boost from '../../../PM/Tickets/Boost/module';
import * as PM_Tickets_Common from '../../../PM/Tickets/Common/module';
import * as PM_Tickets_Parlay from '../../../PM/Tickets/Parlay/module';
import * as PM_Tickets_Range from '../../../PM/Tickets/Range/module';

export declare type Book_IssueBoost = {
  navCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Reserve.NavStatement>,
  reserveShardCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>,
  houseShardCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>,
  user: damlTypes.Party,
  termsCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms>,
  pairId: string,
  side: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side,
  priceTicks: damlTypes.Int,
  lots: damlTypes.Int,
  leverageBps: damlTypes.Int,
  stake: damlTypes.Int,
  fronted: damlTypes.Int,
  premium: damlTypes.Int,
  barrierE8: damlTypes.Int,
  knockOutProceeds: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Book_IssueBoost:
  damlTypes.Serializable<Book_IssueBoost>

export declare type Book_IssueParlay = {
  navCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Reserve.NavStatement>,
  shardCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>,
  user: damlTypes.Party,
  picks: pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms>, pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side>[],
  stake: damlTypes.Int,
  maxPayout: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Book_IssueParlay:
  damlTypes.Serializable<Book_IssueParlay>

export declare type Book_IssueRange = {
  navCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Reserve.NavStatement>,
  shardCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>,
  user: damlTypes.Party,
  termsCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms>,
  kind: PM_Tickets_Range.RangeKind,
  side: PM_Tickets_Range.RangeSide,
  lowE8: damlTypes.Int,
  highE8: damlTypes.Int,
  stake: damlTypes.Int,
  maxPayout: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Book_IssueRange:
  damlTypes.Serializable<Book_IssueRange>

export declare type Book_Prune = {
  before: damlTypes.Time,
}

export declare const Book_Prune:
  damlTypes.Serializable<Book_Prune>

export declare type Book_SetParams = {
  newParams: RiskParams,
}

export declare const Book_SetParams:
  damlTypes.Serializable<Book_SetParams>

export declare type Product =
  | 'RangeProduct'
  | 'ParlayProduct'
  | 'BoostProduct'


export declare const Product:
  damlTypes.Serializable<Product> & { readonly keys: Product[] } & { readonly [e in Product]: e }

export declare type RiskBook = {
  venue: damlTypes.Party,
  reserveId: string,
  product: Product,
  params: RiskParams,
  locked: damlTypes.Map<damlTypes.Time, damlTypes.Int>,
}

export declare interface RiskBookInterface {
  Archive: 
    damlTypes.Choice<RiskBook, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RiskBook, undefined>>;
  Book_IssueBoost: 
    damlTypes.Choice<RiskBook, Book_IssueBoost, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<RiskBook>, damlTypes.ContractId<PM_Tickets_Boost.BoostQuote>, PM_Tickets_Common.Paid>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RiskBook, undefined>>;
  Book_IssueParlay: 
    damlTypes.Choice<RiskBook, Book_IssueParlay, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<RiskBook>, damlTypes.ContractId<PM_Tickets_Parlay.ParlayQuote>, damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RiskBook, undefined>>;
  Book_IssueRange: 
    damlTypes.Choice<RiskBook, Book_IssueRange, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<RiskBook>, damlTypes.ContractId<PM_Tickets_Range.RangeQuote>, damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RiskBook, undefined>>;
  Book_Prune: 
    damlTypes.Choice<RiskBook, Book_Prune, damlTypes.ContractId<RiskBook>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RiskBook, undefined>>;
  Book_SetParams: 
    damlTypes.Choice<RiskBook, Book_SetParams, damlTypes.ContractId<RiskBook>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RiskBook, undefined>>;
}
export declare const RiskBook:
  damlTypes.Template<RiskBook, undefined, '#abu-pm-tickets:PM.Tickets.Book:RiskBook'> &
  damlTypes.ToInterface<RiskBook, never> &
  RiskBookInterface

export declare type RiskParams = {
  maxExposureBps: damlTypes.Int,
  maxPerTicket: damlTypes.Int,
  maxPerExpiry: damlTypes.Int,
  maxLeverageBps: damlTypes.Int,
}

export declare const RiskParams:
  damlTypes.Serializable<RiskParams>
