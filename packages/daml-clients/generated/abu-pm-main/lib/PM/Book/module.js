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

var PM_Types = require('../../PM/Types/module');

exports.BookReceipt = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Book:BookReceipt',
    templateIdWithPackageId: '#ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550:PM.Book:BookReceipt',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        book: damlTypes.Text.decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        outcome: PM_Types.Side.decoder,
        resolved: jtv.Decoder.withDefault(null, damlTypes.Optional(PM_Types.Side).decoder),
        kind: damlTypes.Text.decoder,
        lots: damlTypes.Int.decoder,
        cost: damlTypes.Int.decoder,
        proceeds: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        book: damlTypes.Text.encode(__typed__.book),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        outcome: PM_Types.Side.encode(__typed__.outcome),
        resolved: damlTypes.Optional(PM_Types.Side).encode(__typed__.resolved),
        kind: damlTypes.Text.encode(__typed__.kind),
        lots: damlTypes.Int.encode(__typed__.lots),
        cost: damlTypes.Int.encode(__typed__.cost),
        proceeds: damlTypes.Int.encode(__typed__.proceeds),
      };
    },
    Archive: {
      template: function () { return exports.BookReceipt; },
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
    BookReceipt_Prune: {
      template: function () { return exports.BookReceipt; },
      choiceName: 'BookReceipt_Prune',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BookReceipt_Prune.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BookReceipt_Prune.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BookReceipt, ['ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550', '#abu-pm-main']);

exports.BookReceipt_Prune = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
