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
var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@daml.js/daml-prim-DA-Types-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

exports.Payout = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      account: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount).decoder,
      amount: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      account: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount).encode(__typed__.account),
      amount: damlTypes.Int.encode(__typed__.amount),
    };
  },
};

exports.SeasonPool = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-games:PM.Games.Season:SeasonPool',
    templateIdWithPackageId: '#158901a60ff53c2db94c2482a48b03e58cc1e40b05b4c34bebb486e7e7e52023:PM.Games.Season:SeasonPool',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        seasonId: damlTypes.Text.decoder,
        endsAt: damlTypes.Time.decoder,
        amount: damlTypes.Int.decoder,
        deposited: damlTypes.Int.decoder,
        distributed: damlTypes.Bool.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        seasonId: damlTypes.Text.encode(__typed__.seasonId),
        endsAt: damlTypes.Time.encode(__typed__.endsAt),
        amount: damlTypes.Int.encode(__typed__.amount),
        deposited: damlTypes.Int.encode(__typed__.deposited),
        distributed: damlTypes.Bool.encode(__typed__.distributed),
      };
    },
    Archive: {
      template: function () { return exports.SeasonPool; },
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
    Season_Distribute: {
      template: function () { return exports.SeasonPool; },
      choiceName: 'Season_Distribute',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Season_Distribute.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Season_Distribute.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.SeasonPool), damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.SeasonPool), damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).encode(__typed__); },
    },
    Season_Fund: {
      template: function () { return exports.SeasonPool; },
      choiceName: 'Season_Fund',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Season_Fund.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Season_Fund.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.SeasonPool).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.SeasonPool).encode(__typed__); },
    },
    Season_WithdrawRemainder: {
      template: function () { return exports.SeasonPool; },
      choiceName: 'Season_WithdrawRemainder',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Season_WithdrawRemainder.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Season_WithdrawRemainder.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.SeasonPool, ['158901a60ff53c2db94c2482a48b03e58cc1e40b05b4c34bebb486e7e7e52023', '#abu-pm-games']);

exports.Season_Distribute = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      payouts: damlTypes.List(exports.Payout).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      payouts: damlTypes.List(exports.Payout).encode(__typed__.payouts),
    };
  },
};

exports.Season_Fund = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.Season_WithdrawRemainder = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
