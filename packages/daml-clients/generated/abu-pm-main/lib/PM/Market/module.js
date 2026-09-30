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

var PM_Oracle = require('../../PM/Oracle/module');
var PM_Types = require('../../PM/Types/module');

exports.MarketTerms = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Market:MarketTerms',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Market:MarketTerms',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        seriesKey: damlTypes.Text.decoder,
        marketId: damlTypes.Text.decoder,
        index: damlTypes.Int.decoder,
        symbol: damlTypes.Text.decoder,
        cashUnit: damlTypes.Int.decoder,
        tradingStart: damlTypes.Time.decoder,
        lockAt: damlTypes.Time.decoder,
        expiry: damlTypes.Time.decoder,
        openDeadline: damlTypes.Time.decoder,
        closeDeadline: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
        policyVersion: damlTypes.Int.decoder,
        printSource: damlTypes.Text.decoder,
        minDelaySec: damlTypes.Int.decoder,
        barLenSec: damlTypes.Int.decoder,
        tieUp: damlTypes.Bool.decoder,
        oracles: damlTypes.List(damlTypes.Party).decoder,
        quorum: damlTypes.Int.decoder,
        maxDeviationBps: damlTypes.Int.decoder,
        closeAdmissionSec: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        seriesKey: damlTypes.Text.encode(__typed__.seriesKey),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        index: damlTypes.Int.encode(__typed__.index),
        symbol: damlTypes.Text.encode(__typed__.symbol),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        tradingStart: damlTypes.Time.encode(__typed__.tradingStart),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        expiry: damlTypes.Time.encode(__typed__.expiry),
        openDeadline: damlTypes.Time.encode(__typed__.openDeadline),
        closeDeadline: damlTypes.Time.encode(__typed__.closeDeadline),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
        policyVersion: damlTypes.Int.encode(__typed__.policyVersion),
        printSource: damlTypes.Text.encode(__typed__.printSource),
        minDelaySec: damlTypes.Int.encode(__typed__.minDelaySec),
        barLenSec: damlTypes.Int.encode(__typed__.barLenSec),
        tieUp: damlTypes.Bool.encode(__typed__.tieUp),
        oracles: damlTypes.List(damlTypes.Party).encode(__typed__.oracles),
        quorum: damlTypes.Int.encode(__typed__.quorum),
        maxDeviationBps: damlTypes.Int.encode(__typed__.maxDeviationBps),
        closeAdmissionSec: damlTypes.Optional(damlTypes.Int).encode(__typed__.closeAdmissionSec),
      };
    },
    Archive: {
      template: function () { return exports.MarketTerms; },
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
    Terms_RecordOpen: {
      template: function () { return exports.MarketTerms; },
      choiceName: 'Terms_RecordOpen',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Terms_RecordOpen.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Terms_RecordOpen.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Either(damlTypes.ContractId(exports.Resolution), damlTypes.ContractId(exports.OpenPrint)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Either(damlTypes.ContractId(exports.Resolution), damlTypes.ContractId(exports.OpenPrint)).encode(__typed__); },
    },
    Terms_Resolve: {
      template: function () { return exports.MarketTerms; },
      choiceName: 'Terms_Resolve',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Terms_Resolve.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Terms_Resolve.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.Resolution).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.Resolution).encode(__typed__); },
    },
    Terms_Void: {
      template: function () { return exports.MarketTerms; },
      choiceName: 'Terms_Void',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Terms_Void.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Terms_Void.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.Resolution).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.Resolution).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.MarketTerms, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);

exports.OpenPrint = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Market:OpenPrint',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Market:OpenPrint',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(exports.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        openPriceE8: damlTypes.Int.decoder,
        evidence: damlTypes.List(PM_Oracle.Evidence).decoder,
        signers: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        termsCid: damlTypes.ContractId(exports.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        openPriceE8: damlTypes.Int.encode(__typed__.openPriceE8),
        evidence: damlTypes.List(PM_Oracle.Evidence).encode(__typed__.evidence),
        signers: damlTypes.Int.encode(__typed__.signers),
      };
    },
    Archive: {
      template: function () { return exports.OpenPrint; },
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

damlTypes.registerTemplate(exports.OpenPrint, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);

exports.Resolution = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Market:Resolution',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Market:Resolution',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(exports.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        outcome: jtv.Decoder.withDefault(null, damlTypes.Optional(PM_Types.Side).decoder),
        voidReason: jtv.Decoder.withDefault(null, damlTypes.Optional(PM_Types.VoidReason).decoder),
        openPriceE8: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
        closePriceE8: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
        openEvidence: damlTypes.List(PM_Oracle.Evidence).decoder,
        closeEvidence: damlTypes.List(PM_Oracle.Evidence).decoder,
        signers: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        termsCid: damlTypes.ContractId(exports.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        outcome: damlTypes.Optional(PM_Types.Side).encode(__typed__.outcome),
        voidReason: damlTypes.Optional(PM_Types.VoidReason).encode(__typed__.voidReason),
        openPriceE8: damlTypes.Optional(damlTypes.Int).encode(__typed__.openPriceE8),
        closePriceE8: damlTypes.Optional(damlTypes.Int).encode(__typed__.closePriceE8),
        openEvidence: damlTypes.List(PM_Oracle.Evidence).encode(__typed__.openEvidence),
        closeEvidence: damlTypes.List(PM_Oracle.Evidence).encode(__typed__.closeEvidence),
        signers: damlTypes.Int.encode(__typed__.signers),
      };
    },
    Archive: {
      template: function () { return exports.Resolution; },
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

damlTypes.registerTemplate(exports.Resolution, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);

exports.Terms_RecordOpen = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      stateCid: damlTypes.ContractId(exports.WindowState).decoder,
      quoteCids: damlTypes.List(damlTypes.ContractId(PM_Oracle.PriceQuote)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      stateCid: damlTypes.ContractId(exports.WindowState).encode(__typed__.stateCid),
      quoteCids: damlTypes.List(damlTypes.ContractId(PM_Oracle.PriceQuote)).encode(__typed__.quoteCids),
    };
  },
};

exports.Terms_Resolve = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      openCid: damlTypes.ContractId(exports.OpenPrint).decoder,
      quoteCids: damlTypes.List(damlTypes.ContractId(PM_Oracle.PriceQuote)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      openCid: damlTypes.ContractId(exports.OpenPrint).encode(__typed__.openCid),
      quoteCids: damlTypes.List(damlTypes.ContractId(PM_Oracle.PriceQuote)).encode(__typed__.quoteCids),
    };
  },
};

exports.Terms_Void = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      stage: exports.VoidStage.decoder,
      quoteCids: damlTypes.List(damlTypes.ContractId(PM_Oracle.PriceQuote)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      stage: exports.VoidStage.encode(__typed__.stage),
      quoteCids: damlTypes.List(damlTypes.ContractId(PM_Oracle.PriceQuote)).encode(__typed__.quoteCids),
    };
  },
};

exports.VoidStage = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("BeforeOpen"),
        value: exports.VoidStage.BeforeOpen.decoder,
      }),
      jtv.object({
        tag: jtv.constant("AfterOpen"),
        value: exports.VoidStage.AfterOpen.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'BeforeOpen': return {tag: __typed__.tag, value: exports.VoidStage.BeforeOpen.encode(__typed__.value)};
      case 'AfterOpen': return {tag: __typed__.tag, value: exports.VoidStage.AfterOpen.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type VoidStage';
    }
  },
  AfterOpen: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        openCid: damlTypes.ContractId(exports.OpenPrint).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        openCid: damlTypes.ContractId(exports.OpenPrint).encode(__typed__.openCid),
      };
    },
  },
  BeforeOpen: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        stateCid: damlTypes.ContractId(exports.WindowState).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        stateCid: damlTypes.ContractId(exports.WindowState).encode(__typed__.stateCid),
      };
    },
  },
};

exports.WindowState = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Market:WindowState',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Market:WindowState',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(exports.MarketTerms).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        termsCid: damlTypes.ContractId(exports.MarketTerms).encode(__typed__.termsCid),
      };
    },
    Archive: {
      template: function () { return exports.WindowState; },
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

damlTypes.registerTemplate(exports.WindowState, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);
