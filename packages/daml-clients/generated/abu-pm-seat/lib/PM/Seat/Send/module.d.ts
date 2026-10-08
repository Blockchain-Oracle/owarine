// Generated from ../../../PM/Seat/Send/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a from '@daml.js/abu-pm-main-0.5.2';

export declare type CashTransferOffer = {
  venue: damlTypes.Party,
  sender: damlTypes.Party,
  receiver: damlTypes.Party,
  amount: damlTypes.Int,
  memo: string,
}

export declare interface CashTransferOfferInterface {
  Archive: 
    damlTypes.Choice<CashTransferOffer, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CashTransferOffer, undefined>>;
  Offer_Accept: 
    damlTypes.Choice<CashTransferOffer, Offer_Accept, damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CashTransferOffer, undefined>>;
  Offer_Reject: 
    damlTypes.Choice<CashTransferOffer, Offer_Reject, damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CashTransferOffer, undefined>>;
  Offer_Withdraw: 
    damlTypes.Choice<CashTransferOffer, Offer_Withdraw, damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CashTransferOffer, undefined>>;
}
export declare const CashTransferOffer:
  damlTypes.Template<CashTransferOffer, undefined, '#abu-pm-seat:PM.Seat.Send:CashTransferOffer'> &
  damlTypes.ToInterface<CashTransferOffer, never> &
  CashTransferOfferInterface

export declare type Offer_Accept = {
}

export declare const Offer_Accept:
  damlTypes.Serializable<Offer_Accept>

export declare type Offer_Reject = {
}

export declare const Offer_Reject:
  damlTypes.Serializable<Offer_Reject>

export declare type Offer_Withdraw = {
}

export declare const Offer_Withdraw:
  damlTypes.Serializable<Offer_Withdraw>

export declare type TransferDesk = {
  venue: damlTypes.Party,
}

export declare interface TransferDeskInterface {
  Archive: 
    damlTypes.Choice<TransferDesk, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<TransferDesk, undefined>>;
  TransferDesk_Offer: 
    damlTypes.Choice<TransferDesk, TransferDesk_Offer, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<CashTransferOffer>, damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<TransferDesk, undefined>>;
}
export declare const TransferDesk:
  damlTypes.Template<TransferDesk, undefined, '#abu-pm-seat:PM.Seat.Send:TransferDesk'> &
  damlTypes.ToInterface<TransferDesk, never> &
  TransferDeskInterface

export declare type TransferDesk_Offer = {
  sender: damlTypes.Party,
  receiver: damlTypes.Party,
  cash: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>[],
  amount: damlTypes.Int,
  memo: string,
}

export declare const TransferDesk_Offer:
  damlTypes.Serializable<TransferDesk_Offer>
