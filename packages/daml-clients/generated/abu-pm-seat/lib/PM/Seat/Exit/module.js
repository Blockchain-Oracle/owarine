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

var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');
var pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a = require('@daml.js/abu-pm-main-0.5.2');

exports.ExitFill = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      paid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).decoder,
      venueLegs: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg)).decoder,
      kept: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg)).decoder),
      fees: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder),
      shardChange: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder),
      remaining: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(exports.RestingExit)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      paid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).encode(__typed__.paid),
      venueLegs: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg)).encode(__typed__.venueLegs),
      kept: damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg)).encode(__typed__.kept),
      fees: damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__.fees),
      shardChange: damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__.shardChange),
      remaining: damlTypes.Optional(damlTypes.ContractId(exports.RestingExit)).encode(__typed__.remaining),
    };
  },
};

exports.RestExit_Cancel = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.RestExit_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.RestExit_Fill = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).decoder,
      legCids: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg)).decoder,
      fillLots: damlTypes.Int.decoder,
      priceTicks: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).encode(__typed__.shardCid),
      legCids: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg)).encode(__typed__.legCids),
      fillLots: damlTypes.Int.encode(__typed__.fillLots),
      priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
    };
  },
};

exports.RestExit_Ratchet = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newStopE8: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newStopE8: damlTypes.Int.encode(__typed__.newStopE8),
    };
  },
};

exports.RestExit_Withdraw = {
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

exports.RestingExit = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-seat:PM.Seat.Exit:RestingExit',
    templateIdWithPackageId: '#9f73ecb7e400a6e765089b22559075387de3706d509cf03668d5c82aa472d08f:PM.Seat.Exit:RestingExit',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        owner: damlTypes.Party.decoder,
        venue: damlTypes.Party.decoder,
        exitRef: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        outcome: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        floorTicks: damlTypes.Int.decoder,
        takeProfitTicks: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
        stop: jtv.Decoder.withDefault(null, damlTypes.Optional(exports.Stop).decoder),
        expiresAt: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        owner: damlTypes.Party.encode(__typed__.owner),
        venue: damlTypes.Party.encode(__typed__.venue),
        exitRef: damlTypes.Text.encode(__typed__.exitRef),
        termsCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        outcome: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side.encode(__typed__.outcome),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        floorTicks: damlTypes.Int.encode(__typed__.floorTicks),
        takeProfitTicks: damlTypes.Optional(damlTypes.Int).encode(__typed__.takeProfitTicks),
        stop: damlTypes.Optional(exports.Stop).encode(__typed__.stop),
        expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      };
    },
    Archive: {
      template: function () { return exports.RestingExit; },
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
    RestExit_Cancel: {
      template: function () { return exports.RestingExit; },
      choiceName: 'RestExit_Cancel',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestExit_Cancel.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestExit_Cancel.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    RestExit_Expire: {
      template: function () { return exports.RestingExit; },
      choiceName: 'RestExit_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestExit_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestExit_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    RestExit_Fill: {
      template: function () { return exports.RestingExit; },
      choiceName: 'RestExit_Fill',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestExit_Fill.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestExit_Fill.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return exports.ExitFill.decoder;
      }),
      resultEncode: function (__typed__) { return exports.ExitFill.encode(__typed__); },
    },
    RestExit_Ratchet: {
      template: function () { return exports.RestingExit; },
      choiceName: 'RestExit_Ratchet',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestExit_Ratchet.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestExit_Ratchet.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.RestingExit).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.RestingExit).encode(__typed__); },
    },
    RestExit_Withdraw: {
      template: function () { return exports.RestingExit; },
      choiceName: 'RestExit_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RestExit_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RestExit_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RestingExit, ['9f73ecb7e400a6e765089b22559075387de3706d509cf03668d5c82aa472d08f', '#abu-pm-seat']);

exports.Stop = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      stopE8: damlTypes.Int.decoder,
      trailBps: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      stopE8: damlTypes.Int.encode(__typed__.stopE8),
      trailBps: damlTypes.Optional(damlTypes.Int).encode(__typed__.trailBps),
    };
  },
};
