"use strict";
/* eslint-disable-next-line no-unused-vars */
function __export(m) {
/* eslint-disable-next-line no-prototype-builtins */
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });

/* eslint-disable-next-line no-unused-vars */
var jtv = require('@mojotech/json-type-validation');
/* eslint-disable-next-line no-unused-vars */
var damlTypes = require('@daml/types');

var pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c = require('@daml.js/abu-pm-main-0.5.0');
var pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f = require('@daml.js/splice-api-token-metadata-v1-1.0.0');
var pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281 = require('@daml.js/splice-api-token-transfer-instruction-v1-1.0.0');
var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@daml.js/daml-prim-DA-Types-1.0.0');
var pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b = require('@daml.js/splice-api-token-holding-v1-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

var PM_CC_Listing = require('../../../PM/CC/Listing/module');
var PM_CC_Records = require('../../../PM/CC/Records/module');

exports.CcWithdrawProposal = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-cc:PM.CC.Withdraw:CcWithdrawProposal',
    templateIdWithPackageId: '#3a36b786a702f6601ca9f92f3a356dab86c7a62c191ac83b4e3e1ad742814a9a:PM.CC.Withdraw:CcWithdrawProposal',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        owner: damlTypes.Party.decoder,
        venue: damlTypes.Party.decoder,
        listingId: damlTypes.Text.decoder,
        units: damlTypes.Int.decoder,
        ref: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        owner: damlTypes.Party.encode(__typed__.owner),
        venue: damlTypes.Party.encode(__typed__.venue),
        listingId: damlTypes.Text.encode(__typed__.listingId),
        units: damlTypes.Int.encode(__typed__.units),
        ref: damlTypes.Text.encode(__typed__.ref),
      };
    },
    Archive: {
      template: function () { return exports.CcWithdrawProposal; },
      choiceName: 'Archive',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.decoder;
      }),
      argumentEncode: function (__typed__) { return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Proposal_Accept: {
      template: function () { return exports.CcWithdrawProposal; },
      choiceName: 'Proposal_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Proposal_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Proposal_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_CC_Records.CcWithdrawal), damlTypes.Optional(damlTypes.ContractId(PM_CC_Records.CcAllowance))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_CC_Records.CcWithdrawal), damlTypes.Optional(damlTypes.ContractId(PM_CC_Records.CcAllowance))).encode(__typed__); },
    },
    Proposal_Cancel: {
      template: function () { return exports.CcWithdrawProposal; },
      choiceName: 'Proposal_Cancel',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Proposal_Cancel.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Proposal_Cancel.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Proposal_Decline: {
      template: function () { return exports.CcWithdrawProposal; },
      choiceName: 'Proposal_Decline',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Proposal_Decline.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Proposal_Decline.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CcWithdrawProposal, ['3a36b786a702f6601ca9f92f3a356dab86c7a62c191ac83b4e3e1ad742814a9a', '#abu-pm-cc']);

exports.Proposal_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      listingCid: damlTypes.ContractId(PM_CC_Listing.CcListing).decoder,
      accountCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount).decoder,
      cashCids: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder,
      allowanceCid: damlTypes.ContractId(PM_CC_Records.CcAllowance).decoder,
      factoryCid: damlTypes.ContractId(pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferFactory).decoder,
      inputHoldingCids: damlTypes.List(damlTypes.ContractId(pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b.Splice.Api.Token.HoldingV1.Holding)).decoder,
      requestedAt: damlTypes.Time.decoder,
      executeBefore: damlTypes.Time.decoder,
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      listingCid: damlTypes.ContractId(PM_CC_Listing.CcListing).encode(__typed__.listingCid),
      accountCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount).encode(__typed__.accountCid),
      cashCids: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__.cashCids),
      allowanceCid: damlTypes.ContractId(PM_CC_Records.CcAllowance).encode(__typed__.allowanceCid),
      factoryCid: damlTypes.ContractId(pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferFactory).encode(__typed__.factoryCid),
      inputHoldingCids: damlTypes.List(damlTypes.ContractId(pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b.Splice.Api.Token.HoldingV1.Holding)).encode(__typed__.inputHoldingCids),
      requestedAt: damlTypes.Time.encode(__typed__.requestedAt),
      executeBefore: damlTypes.Time.encode(__typed__.executeBefore),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.encode(__typed__.extraArgs),
    };
  },
};

exports.Proposal_Cancel = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Proposal_Decline = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      reason: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      reason: damlTypes.Text.encode(__typed__.reason),
    };
  },
};
