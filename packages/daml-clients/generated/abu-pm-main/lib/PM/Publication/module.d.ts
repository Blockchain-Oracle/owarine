// Generated from ../../PM/Publication/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Types from '../../PM/Types/module';

export declare type Publication = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  handle: string,
  marketId: string,
  pairId: string,
  outcome: PM_Types.Side,
  lots: damlTypes.Int,
  backingShare: damlTypes.Int,
}

export declare interface PublicationInterface {
  Archive: 
    damlTypes.Choice<Publication, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Publication, undefined>>;
  Publication_Retract: 
    damlTypes.Choice<Publication, Publication_Retract, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Publication, undefined>>;
}
export declare const Publication:
  damlTypes.Template<Publication, undefined, '#abu-pm-main:PM.Publication:Publication'> &
  damlTypes.ToInterface<Publication, never> &
  PublicationInterface

export declare type Publication_Retract = {
}

export declare const Publication_Retract:
  damlTypes.Serializable<Publication_Retract>

export declare type Receipt_Dismiss = {
}

export declare const Receipt_Dismiss:
  damlTypes.Serializable<Receipt_Dismiss>

export declare type Receipt_Publish = {
  handle: string,
}

export declare const Receipt_Publish:
  damlTypes.Serializable<Receipt_Publish>

export declare type SettlementReceipt = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  marketId: string,
  pairId: string,
  outcome: PM_Types.Side,
  resolved: damlTypes.Optional<PM_Types.Side>,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  cost: damlTypes.Int,
  payout: damlTypes.Int,
  fee: damlTypes.Int,
}

export declare interface SettlementReceiptInterface {
  Archive: 
    damlTypes.Choice<SettlementReceipt, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SettlementReceipt, undefined>>;
  Receipt_Dismiss: 
    damlTypes.Choice<SettlementReceipt, Receipt_Dismiss, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SettlementReceipt, undefined>>;
  Receipt_Publish: 
    damlTypes.Choice<SettlementReceipt, Receipt_Publish, damlTypes.ContractId<Publication>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SettlementReceipt, undefined>>;
}
export declare const SettlementReceipt:
  damlTypes.Template<SettlementReceipt, undefined, '#abu-pm-main:PM.Publication:SettlementReceipt'> &
  damlTypes.ToInterface<SettlementReceipt, never> &
  SettlementReceiptInterface
