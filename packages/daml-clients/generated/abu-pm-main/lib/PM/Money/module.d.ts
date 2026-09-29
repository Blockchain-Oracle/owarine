// Generated from ../../PM/Money/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type Invite_Accept = {
}

export declare const Invite_Accept:
  damlTypes.Serializable<Invite_Accept>

export declare type Invite_Withdraw = {
}

export declare const Invite_Withdraw:
  damlTypes.Serializable<Invite_Withdraw>

export declare type VenueAccount = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  label: string,
}

export declare interface VenueAccountInterface {
  Archive: 
    damlTypes.Choice<VenueAccount, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueAccount, undefined>>;
  VenueAccount_Close: 
    damlTypes.Choice<VenueAccount, VenueAccount_Close, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueAccount, undefined>>;
  VenueAccount_Credit: 
    damlTypes.Choice<VenueAccount, VenueAccount_Credit, damlTypes.ContractId<VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueAccount, undefined>>;
}
export declare const VenueAccount:
  damlTypes.Template<VenueAccount, undefined, '#abu-pm-main:PM.Money:VenueAccount'> &
  damlTypes.ToInterface<VenueAccount, never> &
  VenueAccountInterface

export declare type VenueAccountInvite = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  label: string,
}

export declare interface VenueAccountInviteInterface {
  Archive: 
    damlTypes.Choice<VenueAccountInvite, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueAccountInvite, undefined>>;
  Invite_Accept: 
    damlTypes.Choice<VenueAccountInvite, Invite_Accept, damlTypes.ContractId<VenueAccount>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueAccountInvite, undefined>>;
  Invite_Withdraw: 
    damlTypes.Choice<VenueAccountInvite, Invite_Withdraw, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueAccountInvite, undefined>>;
}
export declare const VenueAccountInvite:
  damlTypes.Template<VenueAccountInvite, undefined, '#abu-pm-main:PM.Money:VenueAccountInvite'> &
  damlTypes.ToInterface<VenueAccountInvite, never> &
  VenueAccountInviteInterface

export declare type VenueAccount_Close = {
}

export declare const VenueAccount_Close:
  damlTypes.Serializable<VenueAccount_Close>

export declare type VenueAccount_Credit = {
  amount: damlTypes.Int,
  bucket: string,
}

export declare const VenueAccount_Credit:
  damlTypes.Serializable<VenueAccount_Credit>

export declare type VenueCash = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  amount: damlTypes.Int,
  bucket: string,
}

export declare interface VenueCashInterface {
  Archive: 
    damlTypes.Choice<VenueCash, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueCash, undefined>>;
  VenueCash_Merge: 
    damlTypes.Choice<VenueCash, VenueCash_Merge, damlTypes.ContractId<VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueCash, undefined>>;
  VenueCash_Split: 
    damlTypes.Choice<VenueCash, VenueCash_Split, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<VenueCash>, damlTypes.Optional<damlTypes.ContractId<VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueCash, undefined>>;
  VenueCash_Withdraw: 
    damlTypes.Choice<VenueCash, VenueCash_Withdraw, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<VenueCash, undefined>>;
}
export declare const VenueCash:
  damlTypes.Template<VenueCash, undefined, '#abu-pm-main:PM.Money:VenueCash'> &
  damlTypes.ToInterface<VenueCash, never> &
  VenueCashInterface

export declare type VenueCash_Merge = {
  others: damlTypes.ContractId<VenueCash>[],
}

export declare const VenueCash_Merge:
  damlTypes.Serializable<VenueCash_Merge>

export declare type VenueCash_Split = {
  take: damlTypes.Int,
}

export declare const VenueCash_Split:
  damlTypes.Serializable<VenueCash_Split>

export declare type VenueCash_Withdraw = {
}

export declare const VenueCash_Withdraw:
  damlTypes.Serializable<VenueCash_Withdraw>
