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

var PM_Tickets_Common = require('../../../PM/Tickets/Common/module');

exports.RangeKind = {
  RangeTicket: 'RangeTicket',
  Moonshot: 'Moonshot',
  keys: ['RangeTicket', 'Moonshot'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.RangeKind.RangeTicket),
      jtv.constant(exports.RangeKind.Moonshot),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.RangeQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Range:RangeQuote',
    templateIdWithPackageId: '#7baef372d967b444aa5fa3da258a3dab655c182e1b61115dc86ac326e9df996e:PM.Tickets.Range:RangeQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        user: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        kind: exports.RangeKind.decoder,
        side: exports.RangeSide.decoder,
        lowE8: damlTypes.Int.decoder,
        highE8: damlTypes.Int.decoder,
        stake: damlTypes.Int.decoder,
        maxPayout: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
        lockAt: damlTypes.Time.decoder,
        expiry: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        user: damlTypes.Party.encode(__typed__.user),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        kind: exports.RangeKind.encode(__typed__.kind),
        side: exports.RangeSide.encode(__typed__.side),
        lowE8: damlTypes.Int.encode(__typed__.lowE8),
        highE8: damlTypes.Int.encode(__typed__.highE8),
        stake: damlTypes.Int.encode(__typed__.stake),
        maxPayout: damlTypes.Int.encode(__typed__.maxPayout),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        expiry: damlTypes.Time.encode(__typed__.expiry),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
      };
    },
    Archive: {
      template: function () { return exports.RangeQuote; },
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
    RangeQuote_Accept: {
      template: function () { return exports.RangeQuote; },
      choiceName: 'RangeQuote_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RangeQuote_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RangeQuote_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.RangeRound), damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.RangeRound), damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash))).encode(__typed__); },
    },
    RangeQuote_Expire: {
      template: function () { return exports.RangeQuote; },
      choiceName: 'RangeQuote_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RangeQuote_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RangeQuote_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).encode(__typed__); },
    },
    RangeQuote_Withdraw: {
      template: function () { return exports.RangeQuote; },
      choiceName: 'RangeQuote_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RangeQuote_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RangeQuote_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RangeQuote, ['7baef372d967b444aa5fa3da258a3dab655c182e1b61115dc86ac326e9df996e', '#abu-pm-tickets']);

exports.RangeQuote_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.RangeQuote_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.RangeQuote_Withdraw = {
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

exports.RangeRound = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Range:RangeRound',
    templateIdWithPackageId: '#7baef372d967b444aa5fa3da258a3dab655c182e1b61115dc86ac326e9df996e:PM.Tickets.Range:RangeRound',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        kind: exports.RangeKind.decoder,
        side: exports.RangeSide.decoder,
        lowE8: damlTypes.Int.decoder,
        highE8: damlTypes.Int.decoder,
        stake: damlTypes.Int.decoder,
        maxPayout: damlTypes.Int.decoder,
        expiry: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        termsCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        kind: exports.RangeKind.encode(__typed__.kind),
        side: exports.RangeSide.encode(__typed__.side),
        lowE8: damlTypes.Int.encode(__typed__.lowE8),
        highE8: damlTypes.Int.encode(__typed__.highE8),
        stake: damlTypes.Int.encode(__typed__.stake),
        maxPayout: damlTypes.Int.encode(__typed__.maxPayout),
        expiry: damlTypes.Time.encode(__typed__.expiry),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
      };
    },
    Archive: {
      template: function () { return exports.RangeRound; },
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
    Round_Claim: {
      template: function () { return exports.RangeRound; },
      choiceName: 'Round_Claim',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Round_Claim.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Round_Claim.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
    Round_RefundStale: {
      template: function () { return exports.RangeRound; },
      choiceName: 'Round_RefundStale',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Round_RefundStale.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Round_RefundStale.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
    Round_Settle: {
      template: function () { return exports.RangeRound; },
      choiceName: 'Round_Settle',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Round_Settle.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Round_Settle.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.RangeRound, ['7baef372d967b444aa5fa3da258a3dab655c182e1b61115dc86ac326e9df996e', '#abu-pm-tickets']);

exports.RangeSide = {
  Inside: 'Inside',
  Outside: 'Outside',
  keys: ['Inside', 'Outside'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.RangeSide.Inside),
      jtv.constant(exports.RangeSide.Outside),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.Round_Claim = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Round_RefundStale = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Round_Settle = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};
