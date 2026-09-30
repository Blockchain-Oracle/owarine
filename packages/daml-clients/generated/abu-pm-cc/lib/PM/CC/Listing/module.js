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

var PM_CC_Records = require('../../../PM/CC/Records/module');

exports.CcListing = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-cc:PM.CC.Listing:CcListing',
    templateIdWithPackageId: '#3a36b786a702f6601ca9f92f3a356dab86c7a62c191ac83b4e3e1ad742814a9a:PM.CC.Listing:CcListing',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        listingId: damlTypes.Text.decoder,
        instrumentAdmin: damlTypes.Party.decoder,
        instrumentId: damlTypes.Text.decoder,
        unitsPerCoin: damlTypes.Int.decoder,
        minDepositUnits: damlTypes.Int.decoder,
        maxDepositUnits: damlTypes.Int.decoder,
        depositsOpen: damlTypes.Bool.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        listingId: damlTypes.Text.encode(__typed__.listingId),
        instrumentAdmin: damlTypes.Party.encode(__typed__.instrumentAdmin),
        instrumentId: damlTypes.Text.encode(__typed__.instrumentId),
        unitsPerCoin: damlTypes.Int.encode(__typed__.unitsPerCoin),
        minDepositUnits: damlTypes.Int.encode(__typed__.minDepositUnits),
        maxDepositUnits: damlTypes.Int.encode(__typed__.maxDepositUnits),
        depositsOpen: damlTypes.Bool.encode(__typed__.depositsOpen),
      };
    },
    Archive: {
      template: function () { return exports.CcListing; },
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
    Listing_Attest: {
      template: function () { return exports.CcListing; },
      choiceName: 'Listing_Attest',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Listing_Attest.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Listing_Attest.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_CC_Records.CcReserveStatement).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_CC_Records.CcReserveStatement).encode(__typed__); },
    },
    Listing_SetDeposits: {
      template: function () { return exports.CcListing; },
      choiceName: 'Listing_SetDeposits',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Listing_SetDeposits.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Listing_SetDeposits.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.CcListing).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.CcListing).encode(__typed__); },
    },
    Listing_SettleDeposit: {
      template: function () { return exports.CcListing; },
      choiceName: 'Listing_SettleDeposit',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Listing_SettleDeposit.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Listing_SettleDeposit.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(PM_CC_Records.CcDeposit), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash), damlTypes.ContractId(PM_CC_Records.CcAllowance)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(PM_CC_Records.CcDeposit), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash), damlTypes.ContractId(PM_CC_Records.CcAllowance)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CcListing, ['3a36b786a702f6601ca9f92f3a356dab86c7a62c191ac83b4e3e1ad742814a9a', '#abu-pm-cc']);

exports.Listing_Attest = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      holdingCids: damlTypes.List(damlTypes.ContractId(pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b.Splice.Api.Token.HoldingV1.Holding)).decoder,
      allowanceCids: damlTypes.List(damlTypes.ContractId(PM_CC_Records.CcAllowance)).decoder,
      previous: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_CC_Records.CcReserveStatement)).decoder),
      asOf: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      holdingCids: damlTypes.List(damlTypes.ContractId(pkg718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b.Splice.Api.Token.HoldingV1.Holding)).encode(__typed__.holdingCids),
      allowanceCids: damlTypes.List(damlTypes.ContractId(PM_CC_Records.CcAllowance)).encode(__typed__.allowanceCids),
      previous: damlTypes.Optional(damlTypes.ContractId(PM_CC_Records.CcReserveStatement)).encode(__typed__.previous),
      asOf: damlTypes.Time.encode(__typed__.asOf),
    };
  },
};

exports.Listing_SetDeposits = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      open: damlTypes.Bool.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      open: damlTypes.Bool.encode(__typed__.open),
    };
  },
};

exports.Listing_SettleDeposit = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      instructionCid: damlTypes.ContractId(pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferInstruction).decoder,
      accountCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount).decoder,
      allowanceCid: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_CC_Records.CcAllowance)).decoder),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      instructionCid: damlTypes.ContractId(pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferInstruction).encode(__typed__.instructionCid),
      accountCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount).encode(__typed__.accountCid),
      allowanceCid: damlTypes.Optional(damlTypes.ContractId(PM_CC_Records.CcAllowance)).encode(__typed__.allowanceCid),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.encode(__typed__.extraArgs),
    };
  },
};
