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
var pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794 = require('@daml.js/abu-pm-main-0.3.0');

var PM_Tickets_Boost = require('../../../PM/Tickets/Boost/module');
var PM_Tickets_Common = require('../../../PM/Tickets/Common/module');
var PM_Tickets_Parlay = require('../../../PM/Tickets/Parlay/module');
var PM_Tickets_Range = require('../../../PM/Tickets/Range/module');

exports.Book_IssueBoost = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      navCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Reserve.NavStatement).decoder,
      reserveShardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).decoder,
      houseShardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).decoder,
      user: damlTypes.Party.decoder,
      termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).decoder,
      pairId: damlTypes.Text.decoder,
      side: pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Types.Side.decoder,
      priceTicks: damlTypes.Int.decoder,
      lots: damlTypes.Int.decoder,
      leverageBps: damlTypes.Int.decoder,
      stake: damlTypes.Int.decoder,
      fronted: damlTypes.Int.decoder,
      premium: damlTypes.Int.decoder,
      barrierE8: damlTypes.Int.decoder,
      knockOutProceeds: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      navCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Reserve.NavStatement).encode(__typed__.navCid),
      reserveShardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).encode(__typed__.reserveShardCid),
      houseShardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).encode(__typed__.houseShardCid),
      user: damlTypes.Party.encode(__typed__.user),
      termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).encode(__typed__.termsCid),
      pairId: damlTypes.Text.encode(__typed__.pairId),
      side: pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Types.Side.encode(__typed__.side),
      priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
      lots: damlTypes.Int.encode(__typed__.lots),
      leverageBps: damlTypes.Int.encode(__typed__.leverageBps),
      stake: damlTypes.Int.encode(__typed__.stake),
      fronted: damlTypes.Int.encode(__typed__.fronted),
      premium: damlTypes.Int.encode(__typed__.premium),
      barrierE8: damlTypes.Int.encode(__typed__.barrierE8),
      knockOutProceeds: damlTypes.Int.encode(__typed__.knockOutProceeds),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Book_IssueParlay = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      navCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Reserve.NavStatement).decoder,
      shardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).decoder,
      user: damlTypes.Party.decoder,
      picks: damlTypes.List(pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms), pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Types.Side)).decoder,
      stake: damlTypes.Int.decoder,
      maxPayout: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      navCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Reserve.NavStatement).encode(__typed__.navCid),
      shardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).encode(__typed__.shardCid),
      user: damlTypes.Party.encode(__typed__.user),
      picks: damlTypes.List(pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms), pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Types.Side)).encode(__typed__.picks),
      stake: damlTypes.Int.encode(__typed__.stake),
      maxPayout: damlTypes.Int.encode(__typed__.maxPayout),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Book_IssueRange = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      navCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Reserve.NavStatement).decoder,
      shardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).decoder,
      user: damlTypes.Party.decoder,
      termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).decoder,
      kind: PM_Tickets_Range.RangeKind.decoder,
      side: PM_Tickets_Range.RangeSide.decoder,
      lowE8: damlTypes.Int.decoder,
      highE8: damlTypes.Int.decoder,
      stake: damlTypes.Int.decoder,
      maxPayout: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      navCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Reserve.NavStatement).encode(__typed__.navCid),
      shardCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash).encode(__typed__.shardCid),
      user: damlTypes.Party.encode(__typed__.user),
      termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).encode(__typed__.termsCid),
      kind: PM_Tickets_Range.RangeKind.encode(__typed__.kind),
      side: PM_Tickets_Range.RangeSide.encode(__typed__.side),
      lowE8: damlTypes.Int.encode(__typed__.lowE8),
      highE8: damlTypes.Int.encode(__typed__.highE8),
      stake: damlTypes.Int.encode(__typed__.stake),
      maxPayout: damlTypes.Int.encode(__typed__.maxPayout),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Book_Prune = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      before: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      before: damlTypes.Time.encode(__typed__.before),
    };
  },
};

exports.Book_SetParams = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newParams: exports.RiskParams.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newParams: exports.RiskParams.encode(__typed__.newParams),
    };
  },
};

exports.Product = {
  RangeProduct: 'RangeProduct',
  ParlayProduct: 'ParlayProduct',
  BoostProduct: 'BoostProduct',
  keys: ['RangeProduct', 'ParlayProduct', 'BoostProduct'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.Product.RangeProduct),
      jtv.constant(exports.Product.ParlayProduct),
      jtv.constant(exports.Product.BoostProduct),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.RiskBook = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Book:RiskBook',
    templateIdWithPackageId: '#7baef372d967b444aa5fa3da258a3dab655c182e1b61115dc86ac326e9df996e:PM.Tickets.Book:RiskBook',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        product: exports.Product.decoder,
        params: exports.RiskParams.decoder,
        locked: damlTypes.Map(damlTypes.Time, damlTypes.Int).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        product: exports.Product.encode(__typed__.product),
        params: exports.RiskParams.encode(__typed__.params),
        locked: damlTypes.Map(damlTypes.Time, damlTypes.Int).encode(__typed__.locked),
      };
    },
    Archive: {
      template: function () { return exports.RiskBook; },
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
    Book_IssueBoost: {
      template: function () { return exports.RiskBook; },
      choiceName: 'Book_IssueBoost',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Book_IssueBoost.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Book_IssueBoost.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.RiskBook), damlTypes.ContractId(PM_Tickets_Boost.BoostQuote), PM_Tickets_Common.Paid).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.RiskBook), damlTypes.ContractId(PM_Tickets_Boost.BoostQuote), PM_Tickets_Common.Paid).encode(__typed__); },
    },
    Book_IssueParlay: {
      template: function () { return exports.RiskBook; },
      choiceName: 'Book_IssueParlay',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Book_IssueParlay.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Book_IssueParlay.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.RiskBook), damlTypes.ContractId(PM_Tickets_Parlay.ParlayQuote), damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.RiskBook), damlTypes.ContractId(PM_Tickets_Parlay.ParlayQuote), damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash))).encode(__typed__); },
    },
    Book_IssueRange: {
      template: function () { return exports.RiskBook; },
      choiceName: 'Book_IssueRange',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Book_IssueRange.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Book_IssueRange.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.RiskBook), damlTypes.ContractId(PM_Tickets_Range.RangeQuote), damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.RiskBook), damlTypes.ContractId(PM_Tickets_Range.RangeQuote), damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash))).encode(__typed__); },
    },
    Book_Prune: {
      template: function () { return exports.RiskBook; },
      choiceName: 'Book_Prune',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Book_Prune.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Book_Prune.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.RiskBook).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.RiskBook).encode(__typed__); },
    },
    Book_SetParams: {
      template: function () { return exports.RiskBook; },
      choiceName: 'Book_SetParams',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Book_SetParams.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Book_SetParams.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.RiskBook).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.RiskBook).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RiskBook, ['7baef372d967b444aa5fa3da258a3dab655c182e1b61115dc86ac326e9df996e', '#abu-pm-tickets']);

exports.RiskParams = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      maxExposureBps: damlTypes.Int.decoder,
      maxPerTicket: damlTypes.Int.decoder,
      maxPerExpiry: damlTypes.Int.decoder,
      maxLeverageBps: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      maxExposureBps: damlTypes.Int.encode(__typed__.maxExposureBps),
      maxPerTicket: damlTypes.Int.encode(__typed__.maxPerTicket),
      maxPerExpiry: damlTypes.Int.encode(__typed__.maxPerExpiry),
      maxLeverageBps: damlTypes.Int.encode(__typed__.maxLeverageBps),
    };
  },
};
