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
    templateIdWithPackageId: '#ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550:PM.Publication:Publication',
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
        product: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
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
        product: damlTypes.Optional(damlTypes.Text).encode(__typed__.product),
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

damlTypes.registerTemplate(exports.Publication, ['ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550', '#abu-pm-main']);

exports.Publication_Retract = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.ReceiptDetail = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      reserveId: damlTypes.Text.decoder,
      marketIds: damlTypes.List(damlTypes.Text).decoder,
      pick: damlTypes.Text.decoder,
      stake: damlTypes.Int.decoder,
      toReserve: damlTypes.Int.decoder,
      result: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      reserveId: damlTypes.Text.encode(__typed__.reserveId),
      marketIds: damlTypes.List(damlTypes.Text).encode(__typed__.marketIds),
      pick: damlTypes.Text.encode(__typed__.pick),
      stake: damlTypes.Int.encode(__typed__.stake),
      toReserve: damlTypes.Int.encode(__typed__.toReserve),
      result: damlTypes.Text.encode(__typed__.result),
    };
  },
};

exports.Receipt_Dismiss = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Receipt_Publish = {
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

exports.SettlementReceipt = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Publication:SettlementReceipt',
    templateIdWithPackageId: '#ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550:PM.Publication:SettlementReceipt',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        outcome: PM_Types.Side.decoder,
        resolved: jtv.Decoder.withDefault(null, damlTypes.Optional(PM_Types.Side).decoder),
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        backingShare: damlTypes.Int.decoder,
        cost: damlTypes.Int.decoder,
        payout: damlTypes.Int.decoder,
        fee: damlTypes.Int.decoder,
        product: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
        detail: jtv.Decoder.withDefault(null, damlTypes.Optional(exports.ReceiptDetail).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        outcome: PM_Types.Side.encode(__typed__.outcome),
        resolved: damlTypes.Optional(PM_Types.Side).encode(__typed__.resolved),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        backingShare: damlTypes.Int.encode(__typed__.backingShare),
        cost: damlTypes.Int.encode(__typed__.cost),
        payout: damlTypes.Int.encode(__typed__.payout),
        fee: damlTypes.Int.encode(__typed__.fee),
        product: damlTypes.Optional(damlTypes.Text).encode(__typed__.product),
        detail: damlTypes.Optional(exports.ReceiptDetail).encode(__typed__.detail),
      };
    },
    Archive: {
      template: function () { return exports.SettlementReceipt; },
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
    Receipt_Dismiss: {
      template: function () { return exports.SettlementReceipt; },
      choiceName: 'Receipt_Dismiss',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Receipt_Dismiss.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Receipt_Dismiss.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Receipt_Publish: {
      template: function () { return exports.SettlementReceipt; },
      choiceName: 'Receipt_Publish',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Receipt_Publish.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Receipt_Publish.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.Publication).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.Publication).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.SettlementReceipt, ['ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550', '#abu-pm-main']);
