// Generated from ../../../PM/CC/Listing/module.daml

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

import * as PM_CC_Records from '../../../PM/CC/Records/module';

export declare type CcListing = {
  venue: damlTypes.Party,
  auditor: damlTypes.Party,
  listingId: string,
  instrumentAdmin: damlTypes.Party,
  instrumentId: string,
  unitsPerCoin: damlTypes.Int,
  minDepositUnits: damlTypes.Int,
  maxDepositUnits: damlTypes.Int,
  depositsOpen: boolean,
}

export declare interface CcListingInterface {
  Archive: 
    damlTypes.Choice<CcListing, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcListing, undefined>>;
  Listing_Attest: 
    damlTypes.Choice<CcListing, Listing_Attest, damlTypes.ContractId<PM_CC_Records.CcReserveStatement>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcListing, undefined>>;
  Listing_SetDeposits: 
    damlTypes.Choice<CcListing, Listing_SetDeposits, damlTypes.ContractId<CcListing>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcListing, undefined>>;
  Listing_SettleDeposit: 
    damlTypes.Choice<CcListing, Listing_SettleDeposit, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<PM_CC_Records.CcDeposit>, damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>, damlTypes.ContractId<PM_CC_Records.CcAllowance>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CcListing, undefined>>;
}
export declare const CcListing:
  damlTypes.Template<CcListing, undefined, '#abu-pm-cc:PM.CC.Listing:CcListing'> &
  damlTypes.ToInterface<CcListing, never> &
  CcListingInterface

export declare type Listing_Attest = {
  holdingCids: damlTypes.ContractId<pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b.Splice.Api.Token.HoldingV1.Holding>[],
  allowanceCids: damlTypes.ContractId<PM_CC_Records.CcAllowance>[],
  previous: damlTypes.Optional<damlTypes.ContractId<PM_CC_Records.CcReserveStatement>>,
}

export declare const Listing_Attest:
  damlTypes.Serializable<Listing_Attest>

export declare type Listing_SetDeposits = {
  open: boolean,
}

export declare const Listing_SetDeposits:
  damlTypes.Serializable<Listing_SetDeposits>

export declare type Listing_SettleDeposit = {
  instructionCid: damlTypes.ContractId<pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferInstruction>,
  accountCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueAccount>,
  allowanceCid: damlTypes.Optional<damlTypes.ContractId<PM_CC_Records.CcAllowance>>,
  extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs,
}

export declare const Listing_SettleDeposit:
  damlTypes.Serializable<Listing_SettleDeposit>
