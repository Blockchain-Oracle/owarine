// Generated from ../../../PM/CC/Records/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 from '@daml.js/abu-pm-main-0.5.1';
import * as pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f from '@daml.js/splice-api-token-metadata-v1-1.0.0';
import * as pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281 from '@daml.js/splice-api-token-transfer-instruction-v1-1.0.0';
import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type Allowance_Merge = {
  others: damlTypes.ContractId<CcAllowance>[],
}

export declare const Allowance_Merge:
  damlTypes.Serializable<Allowance_Merge>

export declare type CcAllowance = {
  venue: damlTypes.Party,
  auditor: damlTypes.Party,
  owner: damlTypes.Party,
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
  units: damlTypes.Int,
}

export declare interface CcAllowanceInterface {
  Allowance_Merge: 
    damlTypes.Choice<CcAllowance, Allowance_Merge, damlTypes.ContractId<CcAllowance>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcAllowance, undefined>>;
  Archive: 
    damlTypes.Choice<CcAllowance, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcAllowance, undefined>>;
}
export declare const CcAllowance:
  damlTypes.Template<CcAllowance, undefined, '#abu-pm-cc:PM.CC.Records:CcAllowance'> &
  damlTypes.ToInterface<CcAllowance, never> &
  CcAllowanceInterface

export declare type CcDeposit = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  auditor: damlTypes.Party,
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
  receivedAtomic: damlTypes.Int,
  units: damlTypes.Int,
  settledAt: damlTypes.Time,
  ref: string,
}

export declare interface CcDepositInterface {
  Archive: 
    damlTypes.Choice<CcDeposit, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcDeposit, undefined>>;
}
export declare const CcDeposit:
  damlTypes.Template<CcDeposit, undefined, '#abu-pm-cc:PM.CC.Records:CcDeposit'> &
  damlTypes.ToInterface<CcDeposit, never> &
  CcDepositInterface

export declare type CcReserveStatement = {
  venue: damlTypes.Party,
  auditor: damlTypes.Party,
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
  seq: damlTypes.Int,
  asOf: damlTypes.Time,
  heldAtomic: damlTypes.Int,
  heldUnits: damlTypes.Int,
  liabilityAtomic: damlTypes.Int,
  liabilityUnits: damlTypes.Int,
  allowanceCount: damlTypes.Int,
  covered: boolean,
}

export declare interface CcReserveStatementInterface {
  Archive: 
    damlTypes.Choice<CcReserveStatement, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcReserveStatement, undefined>>;
}
export declare const CcReserveStatement:
  damlTypes.Template<CcReserveStatement, undefined, '#abu-pm-cc:PM.CC.Records:CcReserveStatement'> &
  damlTypes.ToInterface<CcReserveStatement, never> &
  CcReserveStatementInterface

export declare type CcWithdrawal = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  auditor: damlTypes.Party,
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
  units: damlTypes.Int,
  sentAtomic: damlTypes.Int,
  state: WithdrawalState,
  instructionCid: damlTypes.Optional<damlTypes.ContractId<pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferInstruction>>,
  openedAt: damlTypes.Time,
  ref: string,
}

export declare interface CcWithdrawalInterface {
  Archive: 
    damlTypes.Choice<CcWithdrawal, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawal, undefined>>;
  Withdrawal_Complete: 
    damlTypes.Choice<CcWithdrawal, Withdrawal_Complete, damlTypes.ContractId<CcWithdrawal>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawal, undefined>>;
  Withdrawal_OwnerReject: 
    damlTypes.Choice<CcWithdrawal, Withdrawal_OwnerReject, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<CcWithdrawal>, damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>, damlTypes.ContractId<CcAllowance>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawal, undefined>>;
  Withdrawal_Refund: 
    damlTypes.Choice<CcWithdrawal, Withdrawal_Refund, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<CcWithdrawal>, damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>, damlTypes.ContractId<CcAllowance>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawal, undefined>>;
}
export declare const CcWithdrawal:
  damlTypes.Template<CcWithdrawal, undefined, '#abu-pm-cc:PM.CC.Records:CcWithdrawal'> &
  damlTypes.ToInterface<CcWithdrawal, never> &
  CcWithdrawalInterface

export declare type Terms = {
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
}

export declare const Terms:
  damlTypes.Serializable<Terms>

export declare type WithdrawalState =
  | 'WdSent'
  | 'WdCompleted'
  | 'WdRefunded'


export declare const WithdrawalState:
  damlTypes.Serializable<WithdrawalState> & { readonly keys: WithdrawalState[] } & { readonly [e in WithdrawalState]: e }

export declare type Withdrawal_Complete = {
}

export declare const Withdrawal_Complete:
  damlTypes.Serializable<Withdrawal_Complete>

export declare type Withdrawal_OwnerReject = {
  accountCid: damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueAccount>,
  allowanceCid: damlTypes.Optional<damlTypes.ContractId<CcAllowance>>,
  extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs,
}

export declare const Withdrawal_OwnerReject:
  damlTypes.Serializable<Withdrawal_OwnerReject>

export declare type Withdrawal_Refund = {
  accountCid: damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueAccount>,
  allowanceCid: damlTypes.Optional<damlTypes.ContractId<CcAllowance>>,
  extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs,
}

export declare const Withdrawal_Refund:
  damlTypes.Serializable<Withdrawal_Refund>
