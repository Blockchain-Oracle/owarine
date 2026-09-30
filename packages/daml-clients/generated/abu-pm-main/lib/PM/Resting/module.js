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

var PM_Leg = require('../../PM/Leg/module');
var PM_Market = require('../../PM/Market/module');
var PM_Money = require('../../PM/Money/module');
var PM_Types = require('../../PM/Types/module');

exports.RestDesk_Offer = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      owner: damlTypes.Party.decoder,
      termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
      callRef: damlTypes.Text.decoder,
      side: PM_Types.Side.decoder,
      lots: damlTypes.Int.decoder,
      priceTicks: damlTypes.Int.decoder,
      expiresAt: damlTypes.Time.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      owner: damlTypes.Party.encode(__typed__.owner),
      termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
      callRef: damlTypes.Text.encode(__typed__.callRef),
      side: PM_Types.Side.encode(__typed__.side),
      lots: damlTypes.Int.encode(__typed__.lots),
      priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
      expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.RestFill = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      userLeg: damlTypes.ContractId(PM_Leg.Leg).decoder,
      venueLeg: damlTypes.ContractId(PM_Leg.Leg).decoder,
      shardChange: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).decoder),
      remaining: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(exports.RestingCall)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      userLeg: damlTypes.ContractId(PM_Leg.Leg).encode(__typed__.userLeg),
      venueLeg: damlTypes.ContractId(PM_Leg.Leg).encode(__typed__.venueLeg),
      shardChange: damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.shardChange),
      remaining: damlTypes.Optional(damlTypes.ContractId(exports.RestingCall)).encode(__typed__.remaining),
    };
  },
};

exports.RestOffer_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.RestOffer_Place = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.Rest_Cancel = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Rest_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Rest_Fill = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).decoder,
      fillLots: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__.shardCid),
      fillLots: damlTypes.Int.encode(__typed__.fillLots),
    };
  },
};

exports.RestingCall = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Resting:RestingCall',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Resting:RestingCall',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        callRef: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        side: PM_Types.Side.decoder,
        priceTicks: damlTypes.Int.decoder,
        lotsPlaced: damlTypes.Int.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        escrow: damlTypes.Int.decoder,
        tradingStart: damlTypes.Time.decoder,
        lockAt: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
        expiresAt: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        callRef: damlTypes.Text.encode(__typed__.callRef),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        side: PM_Types.Side.encode(__typed__.side),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        lotsPlaced: damlTypes.Int.encode(__typed__.lotsPlaced),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        escrow: damlTypes.Int.encode(__typed__.escrow),
        tradingStart: damlTypes.Time.encode(__typed__.tradingStart),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
        expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      };
    },
    Archive: {
      template: function () { return exports.RestingCall; },
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
    Rest_Cancel: {
      template: function () { return exports.RestingCall; },
      choiceName: 'Rest_Cancel',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Rest_Cancel.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Rest_Cancel.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
    Rest_Expire: {
      template: function () { return exports.RestingCall; },
      choiceName: 'Rest_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Rest_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Rest_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
    Rest_Fill: {
      template: function () { return exports.RestingCall; },
      choiceName: 'Rest_Fill',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Rest_Fill.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Rest_Fill.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return exports.RestFill.decoder;
      }),
      resultEncode: function (__typed__) { return exports.RestFill.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RestingCall, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.RestingDesk = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Resting:RestingDesk',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Resting:RestingDesk',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
      };
    },
    Archive: {
      template: function () { return exports.RestingDesk; },
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
    RestDesk_Offer: {
      template: function () { return exports.RestingDesk; },
      choiceName: 'RestDesk_Offer',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestDesk_Offer.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestDesk_Offer.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.RestingOffer).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.RestingOffer).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RestingDesk, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.RestingOffer = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Resting:RestingOffer',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Resting:RestingOffer',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        callRef: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        side: PM_Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        priceTicks: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        tradingStart: damlTypes.Time.decoder,
        lockAt: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
        expiresAt: damlTypes.Time.decoder,
        validUntil: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        callRef: damlTypes.Text.encode(__typed__.callRef),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        side: PM_Types.Side.encode(__typed__.side),
        lots: damlTypes.Int.encode(__typed__.lots),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        tradingStart: damlTypes.Time.encode(__typed__.tradingStart),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
        expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
      };
    },
    Archive: {
      template: function () { return exports.RestingOffer; },
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
    RestOffer_Expire: {
      template: function () { return exports.RestingOffer; },
      choiceName: 'RestOffer_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestOffer_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestOffer_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    RestOffer_Place: {
      template: function () { return exports.RestingOffer; },
      choiceName: 'RestOffer_Place',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestOffer_Place.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestOffer_Place.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.RestingCall), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.RestingCall), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RestingOffer, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);
