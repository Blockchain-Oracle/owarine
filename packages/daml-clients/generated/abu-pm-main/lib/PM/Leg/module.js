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

var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@daml.js/daml-prim-DA-Types-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

var PM_Market = require('../../PM/Market/module');
var PM_Money = require('../../PM/Money/module');
var PM_Publication = require('../../PM/Publication/module');
var PM_Types = require('../../PM/Types/module');

exports.Leg = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Leg:Leg',
    templateIdWithPackageId: '#076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c:PM.Leg:Leg',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        outcome: PM_Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        backingShare: damlTypes.Int.decoder,
        feePaid: damlTypes.Int.decoder,
        refundAfter: damlTypes.Time.decoder,
        beneficiaryRef: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
        bookCost: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        outcome: PM_Types.Side.encode(__typed__.outcome),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        backingShare: damlTypes.Int.encode(__typed__.backingShare),
        feePaid: damlTypes.Int.encode(__typed__.feePaid),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
        beneficiaryRef: damlTypes.Optional(damlTypes.Text).encode(__typed__.beneficiaryRef),
        bookCost: damlTypes.Optional(damlTypes.Int).encode(__typed__.bookCost),
      };
    },
    Archive: {
      template: function () { return exports.Leg; },
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
    Leg_Claim: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_Claim',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_Claim.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_Claim.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Leg_CloseOut: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_CloseOut',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_CloseOut.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_CloseOut.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.ContractId(exports.Leg), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.ContractId(exports.Leg), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Leg_Merge: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_Merge',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_Merge.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_Merge.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.Optional(damlTypes.ContractId(exports.NettedResidual))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.Optional(damlTypes.ContractId(exports.NettedResidual))).encode(__typed__); },
    },
    Leg_Publish: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_Publish',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_Publish.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_Publish.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Publication.Publication).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Publication.Publication).encode(__typed__); },
    },
    Leg_RefundStale: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_RefundStale',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_RefundStale.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_RefundStale.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__); },
    },
    Leg_Settle: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_Settle',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_Settle.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_Settle.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Leg_Split: {
      template: function () { return exports.Leg; },
      choiceName: 'Leg_Split',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Leg_Split.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Leg_Split.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Leg), damlTypes.ContractId(exports.Leg)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Leg), damlTypes.ContractId(exports.Leg)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.Leg, ['076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c', '#abu-pm-main']);

exports.Leg_Claim = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Leg_CloseOut = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__.shardCid),
    };
  },
};

exports.Leg_Merge = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      otherCid: damlTypes.ContractId(exports.Leg).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      otherCid: damlTypes.ContractId(exports.Leg).encode(__typed__.otherCid),
    };
  },
};

exports.Leg_Publish = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      handle: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      handle: damlTypes.Text.encode(__typed__.handle),
    };
  },
};

exports.Leg_RefundStale = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Leg_Settle = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Leg_Split = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      splitLots: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      splitLots: damlTypes.Int.encode(__typed__.splitLots),
    };
  },
};

exports.NettedResidual = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Leg:NettedResidual',
    templateIdWithPackageId: '#076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c:PM.Leg:NettedResidual',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        pairA: damlTypes.Text.decoder,
        pairB: damlTypes.Text.decoder,
        heldIfVoid: damlTypes.Int.decoder,
        owedIfResolved: damlTypes.Int.decoder,
        book: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairA: damlTypes.Text.encode(__typed__.pairA),
        pairB: damlTypes.Text.encode(__typed__.pairB),
        heldIfVoid: damlTypes.Int.encode(__typed__.heldIfVoid),
        owedIfResolved: damlTypes.Int.encode(__typed__.owedIfResolved),
        book: damlTypes.Optional(damlTypes.Text).encode(__typed__.book),
      };
    },
    Archive: {
      template: function () { return exports.NettedResidual; },
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
    Residual_Settle: {
      template: function () { return exports.NettedResidual; },
      choiceName: 'Residual_Settle',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Residual_Settle.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Residual_Settle.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.NettedResidual, ['076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c', '#abu-pm-main']);

exports.Residual_Settle = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};
