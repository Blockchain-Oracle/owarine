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

exports.Evidence = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      oracle: damlTypes.Party.decoder,
      priceE8: damlTypes.Int.decoder,
      fetchedAt: damlTypes.Time.decoder,
      payloadHash: damlTypes.Text.decoder,
      quoteCid: damlTypes.ContractId(exports.PriceQuote).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      oracle: damlTypes.Party.encode(__typed__.oracle),
      priceE8: damlTypes.Int.encode(__typed__.priceE8),
      fetchedAt: damlTypes.Time.encode(__typed__.fetchedAt),
      payloadHash: damlTypes.Text.encode(__typed__.payloadHash),
      quoteCid: damlTypes.ContractId(exports.PriceQuote).encode(__typed__.quoteCid),
    };
  },
};

exports.PriceQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Oracle:PriceQuote',
    templateIdWithPackageId: '#a494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794:PM.Oracle:PriceQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        oracle: damlTypes.Party.decoder,
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        symbol: damlTypes.Text.decoder,
        boundaryT: damlTypes.Time.decoder,
        priceE8: damlTypes.Int.decoder,
        barStart: damlTypes.Time.decoder,
        barLenSec: damlTypes.Int.decoder,
        fetchedAt: damlTypes.Time.decoder,
        payloadHash: damlTypes.Text.decoder,
        policyVersion: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        oracle: damlTypes.Party.encode(__typed__.oracle),
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        symbol: damlTypes.Text.encode(__typed__.symbol),
        boundaryT: damlTypes.Time.encode(__typed__.boundaryT),
        priceE8: damlTypes.Int.encode(__typed__.priceE8),
        barStart: damlTypes.Time.encode(__typed__.barStart),
        barLenSec: damlTypes.Int.encode(__typed__.barLenSec),
        fetchedAt: damlTypes.Time.encode(__typed__.fetchedAt),
        payloadHash: damlTypes.Text.encode(__typed__.payloadHash),
        policyVersion: damlTypes.Int.encode(__typed__.policyVersion),
      };
    },
    Archive: {
      template: function () { return exports.PriceQuote; },
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
    PriceQuote_Retire: {
      template: function () { return exports.PriceQuote; },
      choiceName: 'PriceQuote_Retire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.PriceQuote_Retire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.PriceQuote_Retire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.PriceQuote, ['a494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794', '#abu-pm-main']);

exports.PriceQuote_Retire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.PrintRule = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      symbol: damlTypes.Text.decoder,
      boundary: damlTypes.Time.decoder,
      oracles: damlTypes.List(damlTypes.Party).decoder,
      barLenSec: damlTypes.Int.decoder,
      policyVersion: damlTypes.Int.decoder,
      earliest: damlTypes.Time.decoder,
      deadline: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      symbol: damlTypes.Text.encode(__typed__.symbol),
      boundary: damlTypes.Time.encode(__typed__.boundary),
      oracles: damlTypes.List(damlTypes.Party).encode(__typed__.oracles),
      barLenSec: damlTypes.Int.encode(__typed__.barLenSec),
      policyVersion: damlTypes.Int.encode(__typed__.policyVersion),
      earliest: damlTypes.Time.encode(__typed__.earliest),
      deadline: damlTypes.Time.encode(__typed__.deadline),
    };
  },
};
