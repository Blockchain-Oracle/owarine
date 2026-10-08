// Generated from ../../../PM/Seat/Exit/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a from '@daml.js/abu-pm-main-0.5.2';

export declare type ExitFill = {
  paid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>,
  venueLegs: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg>[],
  kept: damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg>>,
  fees: damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>,
  shardChange: damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>,
  remaining: damlTypes.Optional<damlTypes.ContractId<RestingExit>>,
}

export declare const ExitFill:
  damlTypes.Serializable<ExitFill>

export declare type RestExit_Cancel = {
}

export declare const RestExit_Cancel:
  damlTypes.Serializable<RestExit_Cancel>

export declare type RestExit_Expire = {
}

export declare const RestExit_Expire:
  damlTypes.Serializable<RestExit_Expire>

export declare type RestExit_Fill = {
  shardCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>,
  legCids: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg>[],
  fillLots: damlTypes.Int,
  priceTicks: damlTypes.Int,
}

export declare const RestExit_Fill:
  damlTypes.Serializable<RestExit_Fill>

export declare type RestExit_Ratchet = {
  newStopE8: damlTypes.Int,
}

export declare const RestExit_Ratchet:
  damlTypes.Serializable<RestExit_Ratchet>

export declare type RestExit_Withdraw = {
  reason: string,
}

export declare const RestExit_Withdraw:
  damlTypes.Serializable<RestExit_Withdraw>

export declare type RestingExit = {
  owner: damlTypes.Party,
  venue: damlTypes.Party,
  exitRef: string,
  termsCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms>,
  marketId: string,
  outcome: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  floorTicks: damlTypes.Int,
  takeProfitTicks: damlTypes.Optional<damlTypes.Int>,
  stop: damlTypes.Optional<Stop>,
  expiresAt: damlTypes.Time,
}

export declare interface RestingExitInterface {
  Archive: 
    damlTypes.Choice<RestingExit, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingExit, undefined>>;
  RestExit_Cancel: 
    damlTypes.Choice<RestingExit, RestExit_Cancel, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingExit, undefined>>;
  RestExit_Expire: 
    damlTypes.Choice<RestingExit, RestExit_Expire, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingExit, undefined>>;
  RestExit_Fill: 
    damlTypes.Choice<RestingExit, RestExit_Fill, ExitFill, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingExit, undefined>>;
  RestExit_Ratchet: 
    damlTypes.Choice<RestingExit, RestExit_Ratchet, damlTypes.ContractId<RestingExit>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingExit, undefined>>;
  RestExit_Withdraw: 
    damlTypes.Choice<RestingExit, RestExit_Withdraw, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RestingExit, undefined>>;
}
export declare const RestingExit:
  damlTypes.Template<RestingExit, undefined, '#abu-pm-seat:PM.Seat.Exit:RestingExit'> &
  damlTypes.ToInterface<RestingExit, never> &
  RestingExitInterface

export declare type Stop = {
  stopE8: damlTypes.Int,
  trailBps: damlTypes.Optional<damlTypes.Int>,
}

export declare const Stop:
  damlTypes.Serializable<Stop>
