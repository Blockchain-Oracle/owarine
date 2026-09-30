// Generated from ../../PM/Resting/module.daml

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

export declare type RestDesk_Offer = {
  owner: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  callRef: string,
  side: PM_Types.Side,
  lots: damlTypes.Int,
  priceTicks: damlTypes.Int,
  expiresAt: damlTypes.Time,
  validUntil: damlTypes.Time,
}

export declare const RestDesk_Offer:
  damlTypes.Serializable<RestDesk_Offer>

export declare type RestFill = {
  userLeg: damlTypes.ContractId<PM_Leg.Leg>,
  venueLeg: damlTypes.ContractId<PM_Leg.Leg>,
  shardChange: damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>,
  remaining: damlTypes.Optional<damlTypes.ContractId<RestingCall>>,
}

export declare const RestFill:
  damlTypes.Serializable<RestFill>

export declare type RestOffer_Expire = {
}

export declare const RestOffer_Expire:
  damlTypes.Serializable<RestOffer_Expire>

export declare type RestOffer_Place = {
  cash: damlTypes.ContractId<PM_Money.VenueCash>[],
}

export declare const RestOffer_Place:
  damlTypes.Serializable<RestOffer_Place>

export declare type Rest_Cancel = {
}

export declare const Rest_Cancel:
  damlTypes.Serializable<Rest_Cancel>

export declare type Rest_Expire = {
}

export declare const Rest_Expire:
  damlTypes.Serializable<Rest_Expire>

export declare type Rest_Fill = {
  shardCid: damlTypes.ContractId<PM_Money.VenueCash>,
  fillLots: damlTypes.Int,
}

export declare const Rest_Fill:
  damlTypes.Serializable<Rest_Fill>

export declare type RestingCall = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  callRef: string,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  side: PM_Types.Side,
  priceTicks: damlTypes.Int,
  lotsPlaced: damlTypes.Int,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  escrow: damlTypes.Int,
  tradingStart: damlTypes.Time,
  lockAt: damlTypes.Time,
  refundAfter: damlTypes.Time,
  expiresAt: damlTypes.Time,
}

export declare interface RestingCallInterface {
  Archive: 
    damlTypes.Choice<RestingCall, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingCall, undefined>>;
  Rest_Cancel: 
    damlTypes.Choice<RestingCall, Rest_Cancel, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingCall, undefined>>;
  Rest_Expire: 
    damlTypes.Choice<RestingCall, Rest_Expire, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingCall, undefined>>;
  Rest_Fill: 
    damlTypes.Choice<RestingCall, Rest_Fill, RestFill, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingCall, undefined>>;
}
export declare const RestingCall:
  damlTypes.Template<RestingCall, undefined, '#abu-pm-main:PM.Resting:RestingCall'> &
  damlTypes.ToInterface<RestingCall, never> &
  RestingCallInterface

export declare type RestingDesk = {
  venue: damlTypes.Party,
}

export declare interface RestingDeskInterface {
  Archive: 
    damlTypes.Choice<RestingDesk, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingDesk, undefined>>;
  RestDesk_Offer: 
    damlTypes.Choice<RestingDesk, RestDesk_Offer, damlTypes.ContractId<RestingOffer>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingDesk, undefined>>;
}
export declare const RestingDesk:
  damlTypes.Template<RestingDesk, undefined, '#abu-pm-main:PM.Resting:RestingDesk'> &
  damlTypes.ToInterface<RestingDesk, never> &
  RestingDeskInterface

export declare type RestingOffer = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  callRef: string,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  side: PM_Types.Side,
  lots: damlTypes.Int,
  priceTicks: damlTypes.Int,
  cashUnit: damlTypes.Int,
  tradingStart: damlTypes.Time,
  lockAt: damlTypes.Time,
  refundAfter: damlTypes.Time,
  expiresAt: damlTypes.Time,
  validUntil: damlTypes.Time,
}

export declare interface RestingOfferInterface {
  Archive: 
    damlTypes.Choice<RestingOffer, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingOffer, undefined>>;
  RestOffer_Expire: 
    damlTypes.Choice<RestingOffer, RestOffer_Expire, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingOffer, undefined>>;
  RestOffer_Place: 
    damlTypes.Choice<RestingOffer, RestOffer_Place, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<RestingCall>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingOffer, undefined>>;
}
export declare const RestingOffer:
  damlTypes.Template<RestingOffer, undefined, '#abu-pm-main:PM.Resting:RestingOffer'> &
  damlTypes.ToInterface<RestingOffer, never> &
  RestingOfferInterface
