// Generated from ../../../PM/Tickets/Boost/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c from '@daml.js/abu-pm-main-0.5.0';
import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Tickets_Common from '../../../PM/Tickets/Common/module';

export declare type BoostExitQuote = {
  venue: damlTypes.Party,
  user: damlTypes.Party,
  positionCid: damlTypes.ContractId<BoostPosition>,
  pairId: string,
  exitTicks: damlTypes.Int,
  proceeds: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare interface BoostExitQuoteInterface {
  Archive: 
    damlTypes.Choice<BoostExitQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostExitQuote, undefined>>;
  BoostExit_Accept: 
    damlTypes.Choice<BoostExitQuote, BoostExit_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<PM_Tickets_Common.Paid, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostExitQuote, undefined>>;
  BoostExit_Expire: 
    damlTypes.Choice<BoostExitQuote, BoostExit_Expire, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostExitQuote, undefined>>;
  BoostExit_Withdraw: 
    damlTypes.Choice<BoostExitQuote, BoostExit_Withdraw, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostExitQuote, undefined>>;
}
export declare const BoostExitQuote:
  damlTypes.Template<BoostExitQuote, undefined, '#abu-pm-tickets:PM.Tickets.Boost:BoostExitQuote'> &
  damlTypes.ToInterface<BoostExitQuote, never> &
  BoostExitQuoteInterface

export declare type BoostExit_Accept = {
}

export declare const BoostExit_Accept:
  damlTypes.Serializable<BoostExit_Accept>

export declare type BoostExit_Expire = {
}

export declare const BoostExit_Expire:
  damlTypes.Serializable<BoostExit_Expire>

export declare type BoostExit_Withdraw = {
  reason: string,
}

export declare const BoostExit_Withdraw:
  damlTypes.Serializable<BoostExit_Withdraw>

export declare type BoostPosition = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  reserveId: string,
  termsCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.MarketTerms>,
  marketId: string,
  pairId: string,
  side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side,
  priceTicks: damlTypes.Int,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  leverageBps: damlTypes.Int,
  stake: damlTypes.Int,
  fronted: damlTypes.Int,
  premium: damlTypes.Int,
  barrierE8: damlTypes.Int,
  barrierFrom: damlTypes.Time,
  knockOutProceeds: damlTypes.Int,
  lockAt: damlTypes.Time,
  expiry: damlTypes.Time,
  refundAfter: damlTypes.Time,
}

export declare interface BoostPositionInterface {
  Archive: 
    damlTypes.Choice<BoostPosition, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostPosition, undefined>>;
  Boost_Claim: 
    damlTypes.Choice<BoostPosition, Boost_Claim, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostPosition, undefined>>;
  Boost_KnockOut: 
    damlTypes.Choice<BoostPosition, Boost_KnockOut, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<PM_Tickets_Common.Paid, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg>, damlTypes.Optional<damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostPosition, undefined>>;
  Boost_OfferExit: 
    damlTypes.Choice<BoostPosition, Boost_OfferExit, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<BoostExitQuote>, damlTypes.Optional<damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostPosition, undefined>>;
  Boost_RefundStale: 
    damlTypes.Choice<BoostPosition, Boost_RefundStale, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostPosition, undefined>>;
  Boost_Settle: 
    damlTypes.Choice<BoostPosition, Boost_Settle, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostPosition, undefined>>;
}
export declare const BoostPosition:
  damlTypes.Template<BoostPosition, undefined, '#abu-pm-tickets:PM.Tickets.Boost:BoostPosition'> &
  damlTypes.ToInterface<BoostPosition, never> &
  BoostPositionInterface

export declare type BoostQuote = {
  venue: damlTypes.Party,
  user: damlTypes.Party,
  reserveId: string,
  termsCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.MarketTerms>,
  marketId: string,
  pairId: string,
  side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side,
  priceTicks: damlTypes.Int,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  leverageBps: damlTypes.Int,
  stake: damlTypes.Int,
  fronted: damlTypes.Int,
  premium: damlTypes.Int,
  barrierE8: damlTypes.Int,
  knockOutProceeds: damlTypes.Int,
  validUntil: damlTypes.Time,
  lockAt: damlTypes.Time,
  expiry: damlTypes.Time,
  refundAfter: damlTypes.Time,
}

export declare interface BoostQuoteInterface {
  Archive: 
    damlTypes.Choice<BoostQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostQuote, undefined>>;
  BoostQuote_Accept: 
    damlTypes.Choice<BoostQuote, BoostQuote_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<BoostPosition>, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg>, damlTypes.Optional<damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostQuote, undefined>>;
  BoostQuote_Expire: 
    damlTypes.Choice<BoostQuote, BoostQuote_Expire, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostQuote, undefined>>;
  BoostQuote_Withdraw: 
    damlTypes.Choice<BoostQuote, BoostQuote_Withdraw, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BoostQuote, undefined>>;
}
export declare const BoostQuote:
  damlTypes.Template<BoostQuote, undefined, '#abu-pm-tickets:PM.Tickets.Boost:BoostQuote'> &
  damlTypes.ToInterface<BoostQuote, never> &
  BoostQuoteInterface

export declare type BoostQuote_Accept = {
  cash: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>[],
}

export declare const BoostQuote_Accept:
  damlTypes.Serializable<BoostQuote_Accept>

export declare type BoostQuote_Expire = {
}

export declare const BoostQuote_Expire:
  damlTypes.Serializable<BoostQuote_Expire>

export declare type BoostQuote_Withdraw = {
  reason: string,
}

export declare const BoostQuote_Withdraw:
  damlTypes.Serializable<BoostQuote_Withdraw>

export declare type Boost_Claim = {
  resolutionCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.Resolution>,
}

export declare const Boost_Claim:
  damlTypes.Serializable<Boost_Claim>

export declare type Boost_KnockOut = {
  observedAt: damlTypes.Time,
  quoteCids: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Oracle.PriceQuote>[],
  shardCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>,
}

export declare const Boost_KnockOut:
  damlTypes.Serializable<Boost_KnockOut>

export declare type Boost_OfferExit = {
  shardCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>,
  exitTicks: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Boost_OfferExit:
  damlTypes.Serializable<Boost_OfferExit>

export declare type Boost_RefundStale = {
}

export declare const Boost_RefundStale:
  damlTypes.Serializable<Boost_RefundStale>

export declare type Boost_Settle = {
  resolutionCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.Resolution>,
}

export declare const Boost_Settle:
  damlTypes.Serializable<Boost_Settle>
