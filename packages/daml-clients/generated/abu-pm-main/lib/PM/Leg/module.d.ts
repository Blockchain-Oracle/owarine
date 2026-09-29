// Generated from ../../PM/Leg/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Market from '../../PM/Market/module';
import * as PM_Money from '../../PM/Money/module';
import * as PM_Publication from '../../PM/Publication/module';
import * as PM_Types from '../../PM/Types/module';

export declare type Leg = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  pairId: string,
  outcome: PM_Types.Side,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  feePaid: damlTypes.Int,
  refundAfter: damlTypes.Time,
  beneficiaryRef: damlTypes.Optional<string>,
}

export declare interface LegInterface {
  Archive: 
    damlTypes.Choice<Leg, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
  Leg_Claim: 
    damlTypes.Choice<Leg, Leg_Claim, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
  Leg_CloseOut: 
    damlTypes.Choice<Leg, Leg_CloseOut, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, damlTypes.ContractId<Leg>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
  Leg_Merge: 
    damlTypes.Choice<Leg, Leg_Merge, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, damlTypes.Optional<damlTypes.ContractId<NettedResidual>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
  Leg_Publish: 
    damlTypes.Choice<Leg, Leg_Publish, damlTypes.ContractId<PM_Publication.Publication>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
  Leg_RefundStale: 
    damlTypes.Choice<Leg, Leg_RefundStale, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
  Leg_Settle: 
    damlTypes.Choice<Leg, Leg_Settle, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Leg, undefined>>;
}
export declare const Leg:
  damlTypes.Template<Leg, undefined, '#abu-pm-main:PM.Leg:Leg'> &
  damlTypes.ToInterface<Leg, never> &
  LegInterface

export declare type Leg_Claim = {
  resolutionCid: damlTypes.ContractId<PM_Market.Resolution>,
}

export declare const Leg_Claim:
  damlTypes.Serializable<Leg_Claim>

export declare type Leg_CloseOut = {
  shardCid: damlTypes.ContractId<PM_Money.VenueCash>,
}

export declare const Leg_CloseOut:
  damlTypes.Serializable<Leg_CloseOut>

export declare type Leg_Merge = {
  otherCid: damlTypes.ContractId<Leg>,
}

export declare const Leg_Merge:
  damlTypes.Serializable<Leg_Merge>

export declare type Leg_Publish = {
  handle: string,
}

export declare const Leg_Publish:
  damlTypes.Serializable<Leg_Publish>

export declare type Leg_RefundStale = {
}

export declare const Leg_RefundStale:
  damlTypes.Serializable<Leg_RefundStale>

export declare type Leg_Settle = {
  resolutionCid: damlTypes.ContractId<PM_Market.Resolution>,
}

export declare const Leg_Settle:
  damlTypes.Serializable<Leg_Settle>

export declare type NettedResidual = {
  venue: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  pairA: string,
  pairB: string,
  heldIfVoid: damlTypes.Int,
  owedIfResolved: damlTypes.Int,
}

export declare interface NettedResidualInterface {
  Archive: 
    damlTypes.Choice<NettedResidual, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NettedResidual, undefined>>;
  Residual_Settle: 
    damlTypes.Choice<NettedResidual, Residual_Settle, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NettedResidual, undefined>>;
}
export declare const NettedResidual:
  damlTypes.Template<NettedResidual, undefined, '#abu-pm-main:PM.Leg:NettedResidual'> &
  damlTypes.ToInterface<NettedResidual, never> &
  NettedResidualInterface

export declare type Residual_Settle = {
  resolutionCid: damlTypes.ContractId<PM_Market.Resolution>,
}

export declare const Residual_Settle:
  damlTypes.Serializable<Residual_Settle>
