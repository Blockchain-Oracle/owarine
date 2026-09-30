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

var pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 = require('@daml.js/abu-pm-main-0.5.1');
var pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f = require('@daml.js/splice-api-token-metadata-v1-1.0.0');
var pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281 = require('@daml.js/splice-api-token-transfer-instruction-v1-1.0.0');
var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@daml.js/daml-prim-DA-Types-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

exports.Allowance_Merge = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      others: damlTypes.List(damlTypes.ContractId(exports.CcAllowance)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      others: damlTypes.List(damlTypes.ContractId(exports.CcAllowance)).encode(__typed__.others),
    };
  },
};

exports.CcAllowance = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-cc:PM.CC.Records:CcAllowance',
    templateIdWithPackageId: '#2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea:PM.CC.Records:CcAllowance',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        listingId: damlTypes.Text.decoder,
        instrumentAdmin: damlTypes.Party.decoder,
        instrumentId: damlTypes.Text.decoder,
        unitsPerCoin: damlTypes.Int.decoder,
        units: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        owner: damlTypes.Party.encode(__typed__.owner),
        listingId: damlTypes.Text.encode(__typed__.listingId),
        instrumentAdmin: damlTypes.Party.encode(__typed__.instrumentAdmin),
        instrumentId: damlTypes.Text.encode(__typed__.instrumentId),
        unitsPerCoin: damlTypes.Int.encode(__typed__.unitsPerCoin),
        units: damlTypes.Int.encode(__typed__.units),
      };
    },
    Allowance_Merge: {
      template: function () { return exports.CcAllowance; },
      choiceName: 'Allowance_Merge',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Allowance_Merge.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Allowance_Merge.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.CcAllowance).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.CcAllowance).encode(__typed__); },
    },
    Archive: {
      template: function () { return exports.CcAllowance; },
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
  },
);

damlTypes.registerTemplate(exports.CcAllowance, ['2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea', '#abu-pm-cc']);

exports.CcDeposit = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-cc:PM.CC.Records:CcDeposit',
    templateIdWithPackageId: '#2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea:PM.CC.Records:CcDeposit',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        listingId: damlTypes.Text.decoder,
        instrumentAdmin: damlTypes.Party.decoder,
        instrumentId: damlTypes.Text.decoder,
        unitsPerCoin: damlTypes.Int.decoder,
        receivedAtomic: damlTypes.Int.decoder,
        units: damlTypes.Int.decoder,
        settledAt: damlTypes.Time.decoder,
        ref: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        listingId: damlTypes.Text.encode(__typed__.listingId),
        instrumentAdmin: damlTypes.Party.encode(__typed__.instrumentAdmin),
        instrumentId: damlTypes.Text.encode(__typed__.instrumentId),
        unitsPerCoin: damlTypes.Int.encode(__typed__.unitsPerCoin),
        receivedAtomic: damlTypes.Int.encode(__typed__.receivedAtomic),
        units: damlTypes.Int.encode(__typed__.units),
        settledAt: damlTypes.Time.encode(__typed__.settledAt),
        ref: damlTypes.Text.encode(__typed__.ref),
      };
    },
    Archive: {
      template: function () { return exports.CcDeposit; },
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
  },
);

damlTypes.registerTemplate(exports.CcDeposit, ['2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea', '#abu-pm-cc']);

exports.CcReserveStatement = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-cc:PM.CC.Records:CcReserveStatement',
    templateIdWithPackageId: '#2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea:PM.CC.Records:CcReserveStatement',
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
        seq: damlTypes.Int.decoder,
        asOf: damlTypes.Time.decoder,
        heldAtomic: damlTypes.Int.decoder,
        heldUnits: damlTypes.Int.decoder,
        liabilityAtomic: damlTypes.Int.decoder,
        liabilityUnits: damlTypes.Int.decoder,
        allowanceCount: damlTypes.Int.decoder,
        covered: damlTypes.Bool.decoder,
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
        seq: damlTypes.Int.encode(__typed__.seq),
        asOf: damlTypes.Time.encode(__typed__.asOf),
        heldAtomic: damlTypes.Int.encode(__typed__.heldAtomic),
        heldUnits: damlTypes.Int.encode(__typed__.heldUnits),
        liabilityAtomic: damlTypes.Int.encode(__typed__.liabilityAtomic),
        liabilityUnits: damlTypes.Int.encode(__typed__.liabilityUnits),
        allowanceCount: damlTypes.Int.encode(__typed__.allowanceCount),
        covered: damlTypes.Bool.encode(__typed__.covered),
      };
    },
    Archive: {
      template: function () { return exports.CcReserveStatement; },
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
  },
);

damlTypes.registerTemplate(exports.CcReserveStatement, ['2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea', '#abu-pm-cc']);

exports.CcWithdrawal = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-cc:PM.CC.Records:CcWithdrawal',
    templateIdWithPackageId: '#2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea:PM.CC.Records:CcWithdrawal',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        listingId: damlTypes.Text.decoder,
        instrumentAdmin: damlTypes.Party.decoder,
        instrumentId: damlTypes.Text.decoder,
        unitsPerCoin: damlTypes.Int.decoder,
        units: damlTypes.Int.decoder,
        sentAtomic: damlTypes.Int.decoder,
        state: exports.WithdrawalState.decoder,
        instructionCid: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferInstruction)).decoder),
        openedAt: damlTypes.Time.decoder,
        ref: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        listingId: damlTypes.Text.encode(__typed__.listingId),
        instrumentAdmin: damlTypes.Party.encode(__typed__.instrumentAdmin),
        instrumentId: damlTypes.Text.encode(__typed__.instrumentId),
        unitsPerCoin: damlTypes.Int.encode(__typed__.unitsPerCoin),
        units: damlTypes.Int.encode(__typed__.units),
        sentAtomic: damlTypes.Int.encode(__typed__.sentAtomic),
        state: exports.WithdrawalState.encode(__typed__.state),
        instructionCid: damlTypes.Optional(damlTypes.ContractId(pkg55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281.Splice.Api.Token.TransferInstructionV1.TransferInstruction)).encode(__typed__.instructionCid),
        openedAt: damlTypes.Time.encode(__typed__.openedAt),
        ref: damlTypes.Text.encode(__typed__.ref),
      };
    },
    Archive: {
      template: function () { return exports.CcWithdrawal; },
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
    Withdrawal_Complete: {
      template: function () { return exports.CcWithdrawal; },
      choiceName: 'Withdrawal_Complete',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdrawal_Complete.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdrawal_Complete.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.CcWithdrawal).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.CcWithdrawal).encode(__typed__); },
    },
    Withdrawal_OwnerReject: {
      template: function () { return exports.CcWithdrawal; },
      choiceName: 'Withdrawal_OwnerReject',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdrawal_OwnerReject.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdrawal_OwnerReject.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.CcWithdrawal), damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash), damlTypes.ContractId(exports.CcAllowance)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.CcWithdrawal), damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash), damlTypes.ContractId(exports.CcAllowance)).encode(__typed__); },
    },
    Withdrawal_Refund: {
      template: function () { return exports.CcWithdrawal; },
      choiceName: 'Withdrawal_Refund',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdrawal_Refund.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdrawal_Refund.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.CcWithdrawal), damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash), damlTypes.ContractId(exports.CcAllowance)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.CcWithdrawal), damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash), damlTypes.ContractId(exports.CcAllowance)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CcWithdrawal, ['2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea', '#abu-pm-cc']);

exports.Terms = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      listingId: damlTypes.Text.decoder,
      instrumentAdmin: damlTypes.Party.decoder,
      instrumentId: damlTypes.Text.decoder,
      unitsPerCoin: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      listingId: damlTypes.Text.encode(__typed__.listingId),
      instrumentAdmin: damlTypes.Party.encode(__typed__.instrumentAdmin),
      instrumentId: damlTypes.Text.encode(__typed__.instrumentId),
      unitsPerCoin: damlTypes.Int.encode(__typed__.unitsPerCoin),
    };
  },
};

exports.WithdrawalState = {
  WdSent: 'WdSent',
  WdCompleted: 'WdCompleted',
  WdRefunded: 'WdRefunded',
  keys: ['WdSent', 'WdCompleted', 'WdRefunded'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.WithdrawalState.WdSent),
      jtv.constant(exports.WithdrawalState.WdCompleted),
      jtv.constant(exports.WithdrawalState.WdRefunded),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.Withdrawal_Complete = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Withdrawal_OwnerReject = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      accountCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueAccount).decoder,
      allowanceCid: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(exports.CcAllowance)).decoder),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      accountCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueAccount).encode(__typed__.accountCid),
      allowanceCid: damlTypes.Optional(damlTypes.ContractId(exports.CcAllowance)).encode(__typed__.allowanceCid),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.encode(__typed__.extraArgs),
    };
  },
};

exports.Withdrawal_Refund = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      accountCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueAccount).decoder,
      allowanceCid: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(exports.CcAllowance)).decoder),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      accountCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueAccount).encode(__typed__.accountCid),
      allowanceCid: damlTypes.Optional(damlTypes.ContractId(exports.CcAllowance)).encode(__typed__.allowanceCid),
      extraArgs: pkg4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f.Splice.Api.Token.MetadataV1.ExtraArgs.encode(__typed__.extraArgs),
    };
  },
};
