// Generated from ../../PM/Reserve/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Money from '../../PM/Money/module';

export declare type LpShare = {
  venue: damlTypes.Party,
  provider: damlTypes.Party,
  reserveId: string,
  shares: damlTypes.Int,
}

export declare interface LpShareInterface {
  Archive: 
    damlTypes.Choice<LpShare, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<LpShare, undefined>>;
  LpShare_Merge: 
    damlTypes.Choice<LpShare, LpShare_Merge, damlTypes.ContractId<LpShare>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<LpShare, undefined>>;
}
export declare const LpShare:
  damlTypes.Template<LpShare, undefined, '#abu-pm-main:PM.Reserve:LpShare'> &
  damlTypes.ToInterface<LpShare, never> &
  LpShareInterface

export declare type LpShare_Merge = {
  otherCid: damlTypes.ContractId<LpShare>,
}

export declare const LpShare_Merge:
  damlTypes.Serializable<LpShare_Merge>

export declare type NavStatement = {
  venue: damlTypes.Party,
  auditor: damlTypes.Party,
  reserveId: string,
  seq: damlTypes.Int,
  asOf: damlTypes.Time,
  assets: damlTypes.Int,
  shares: damlTypes.Int,
}

export declare interface NavStatementInterface {
  Archive: 
    damlTypes.Choice<NavStatement, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NavStatement, undefined>>;
  Nav_IssueSupply: 
    damlTypes.Choice<NavStatement, Nav_IssueSupply, damlTypes.ContractId<SupplyQuote>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NavStatement, undefined>>;
  Nav_IssueWithdraw: 
    damlTypes.Choice<NavStatement, Nav_IssueWithdraw, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<WithdrawQuote>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NavStatement, undefined>>;
  Nav_Publish: 
    damlTypes.Choice<NavStatement, Nav_Publish, damlTypes.ContractId<NavStatement>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NavStatement, undefined>>;
}
export declare const NavStatement:
  damlTypes.Template<NavStatement, undefined, '#abu-pm-main:PM.Reserve:NavStatement'> &
  damlTypes.ToInterface<NavStatement, never> &
  NavStatementInterface

export declare type Nav_IssueSupply = {
  provider: damlTypes.Party,
  cashIn: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare const Nav_IssueSupply:
  damlTypes.Serializable<Nav_IssueSupply>

export declare type Nav_IssueWithdraw = {
  provider: damlTypes.Party,
  lpShareCid: damlTypes.ContractId<LpShare>,
  sharesIn: damlTypes.Int,
  shardCid: damlTypes.ContractId<PM_Money.VenueCash>,
  validUntil: damlTypes.Time,
}

export declare const Nav_IssueWithdraw:
  damlTypes.Serializable<Nav_IssueWithdraw>

export declare type Nav_Publish = {
  newAsOf: damlTypes.Time,
  newAssets: damlTypes.Int,
  newShares: damlTypes.Int,
}

export declare const Nav_Publish:
  damlTypes.Serializable<Nav_Publish>

export declare type SupplyQuote = {
  venue: damlTypes.Party,
  provider: damlTypes.Party,
  reserveId: string,
  navSeq: damlTypes.Int,
  cashIn: damlTypes.Int,
  sharesOut: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare interface SupplyQuoteInterface {
  Archive: 
    damlTypes.Choice<SupplyQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SupplyQuote, undefined>>;
  Supply_Accept: 
    damlTypes.Choice<SupplyQuote, Supply_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<LpShare>, damlTypes.ContractId<PM_Money.VenueCash>, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SupplyQuote, undefined>>;
  Supply_Expire: 
    damlTypes.Choice<SupplyQuote, Supply_Expire, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SupplyQuote, undefined>>;
  Supply_Withdraw: 
    damlTypes.Choice<SupplyQuote, Supply_Withdraw, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SupplyQuote, undefined>>;
}
export declare const SupplyQuote:
  damlTypes.Template<SupplyQuote, undefined, '#abu-pm-main:PM.Reserve:SupplyQuote'> &
  damlTypes.ToInterface<SupplyQuote, never> &
  SupplyQuoteInterface

export declare type Supply_Accept = {
  cash: damlTypes.ContractId<PM_Money.VenueCash>[],
}

export declare const Supply_Accept:
  damlTypes.Serializable<Supply_Accept>

export declare type Supply_Expire = {
}

export declare const Supply_Expire:
  damlTypes.Serializable<Supply_Expire>

export declare type Supply_Withdraw = {
  reason: string,
}

export declare const Supply_Withdraw:
  damlTypes.Serializable<Supply_Withdraw>

export declare type WithdrawQuote = {
  venue: damlTypes.Party,
  provider: damlTypes.Party,
  reserveId: string,
  navSeq: damlTypes.Int,
  lpShareCid: damlTypes.ContractId<LpShare>,
  sharesIn: damlTypes.Int,
  cashOut: damlTypes.Int,
  validUntil: damlTypes.Time,
}

export declare interface WithdrawQuoteInterface {
  Archive: 
    damlTypes.Choice<WithdrawQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<WithdrawQuote, undefined>>;
  Withdraw_Accept: 
    damlTypes.Choice<WithdrawQuote, Withdraw_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<PM_Money.VenueCash>, damlTypes.Optional<damlTypes.ContractId<LpShare>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<WithdrawQuote, undefined>>;
  Withdraw_Expire: 
    damlTypes.Choice<WithdrawQuote, Withdraw_Expire, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<WithdrawQuote, undefined>>;
  Withdraw_Withdraw: 
    damlTypes.Choice<WithdrawQuote, Withdraw_Withdraw, damlTypes.ContractId<PM_Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<WithdrawQuote, undefined>>;
}
export declare const WithdrawQuote:
  damlTypes.Template<WithdrawQuote, undefined, '#abu-pm-main:PM.Reserve:WithdrawQuote'> &
  damlTypes.ToInterface<WithdrawQuote, never> &
  WithdrawQuoteInterface

export declare type Withdraw_Accept = {
}

export declare const Withdraw_Accept:
  damlTypes.Serializable<Withdraw_Accept>

export declare type Withdraw_Expire = {
}

export declare const Withdraw_Expire:
  damlTypes.Serializable<Withdraw_Expire>

export declare type Withdraw_Withdraw = {
  reason: string,
}

export declare const Withdraw_Withdraw:
  damlTypes.Serializable<Withdraw_Withdraw>
