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

exports.Publication = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Publication:Publication',
    templateIdWithPackageId: '#2359d13841214bda7b42529ffdb6e99fb4fff907648552fb27e25ec6f044deef:PM.Publication:Publication',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        handle: damlTypes.Text.decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        outcome: PM_Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        backingShare: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        handle: damlTypes.Text.encode(__typed__.handle),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        outcome: PM_Types.Side.encode(__typed__.outcome),
        lots: damlTypes.Int.encode(__typed__.lots),
        backingShare: damlTypes.Int.encode(__typed__.backingShare),
      };
    },
    Archive: {
      template: function () { return exports.Publication; },
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
    Publication_Retract: {
      template: function () { return exports.Publication; },
      choiceName: 'Publication_Retract',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Publication_Retract.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Publication_Retract.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.Publication, ['2359d13841214bda7b42529ffdb6e99fb4fff907648552fb27e25ec6f044deef', '#abu-pm-main']);

exports.Publication_Retract = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
