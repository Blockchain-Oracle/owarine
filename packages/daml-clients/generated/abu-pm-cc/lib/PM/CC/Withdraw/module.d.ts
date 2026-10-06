// Generated from ../../../PM/CC/Withdraw/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f from '@daml.js/splice-api-token-metadata-v1-1.0.0';
import * as pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281 from '@daml.js/splice-api-token-transfer-instruction-v1-1.0.0';
import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b from '@daml.js/splice-api-token-holding-v1-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a from '@daml.js/abu-pm-main-0.5.2';

import * as PM_CC_Listing from '../../../PM/CC/Listing/module';
import * as PM_CC_Records from '../../../PM/CC/Records/module';

export declare type CcWithdrawProposal = {
  owner: damlTypes.Party,
  venue: damlTypes.Party,
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
  units: damlTypes.Int,
  validUntil: damlTypes.Time,
  ref: string,
}

export declare interface CcWithdrawProposalInterface {
  Archive: 
    damlTypes.Choice<CcWithdrawProposal, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawProposal, undefined>>;
  Proposal_Accept: 
    damlTypes.Choice<CcWithdrawProposal, Proposal_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<PM_CC_Records.CcWithdrawal>, damlTypes.Optional<damlTypes.ContractId<PM_CC_Records.CcAllowance>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawProposal, undefined>>;
  Proposal_Cancel: 
    damlTypes.Choice<CcWithdrawProposal, Proposal_Cancel, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawProposal, undefined>>;
  Proposal_Decline: 
    damlTypes.Choice<CcWithdrawProposal, Proposal_Decline, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcWithdrawProposal, undefined>>;
}
export declare const CcWithdrawProposal:
  damlTypes.Template<CcWithdrawProposal, undefined, '#abu-pm-cc:PM.CC.Withdraw:CcWithdrawProposal'> &
  damlTypes.ToInterface<CcWithdrawProposal, never> &
  CcWithdrawProposalInterface

export declare type Proposal_Accept = {
  listingCid: damlTypes.ContractId<PM_CC_Listing.CcListing>,
  accountCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueAccount>,
  cashCids: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>[],
  allowanceCid: damlTypes.ContractId<PM_CC_Records.CcAllowance>,
  factoryCid: damlTypes.ContractId<pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferFactory>,
  inputHoldingCids: damlTypes.ContractId<pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b.Splice.Api.Token.HoldingV1.Holding>[],
  requestedAt: damlTypes.Time,
  executeBefore: damlTypes.Time,
  extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs,
}

export declare const Proposal_Accept:
  damlTypes.Serializable<Proposal_Accept>

export declare type Proposal_Cancel = {
}

export declare const Proposal_Cancel:
  damlTypes.Serializable<Proposal_Cancel>

export declare type Proposal_Decline = {
  reason: string,
}

export declare const Proposal_Decline:
  damlTypes.Serializable<Proposal_Decline>
