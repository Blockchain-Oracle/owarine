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
var pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a = require('@daml.js/abu-pm-main-0.5.2');

exports.CashTransferOffer = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-seat:PM.Seat.Send:CashTransferOffer',
    templateIdWithPackageId: '#9f73ecb7e400a6e765089b22559075387de3706d509cf03668d5c82aa472d08f:PM.Seat.Send:CashTransferOffer',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        sender: damlTypes.Party.decoder,
        receiver: damlTypes.Party.decoder,
        amount: damlTypes.Int.decoder,
        memo: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        sender: damlTypes.Party.encode(__typed__.sender),
        receiver: damlTypes.Party.encode(__typed__.receiver),
        amount: damlTypes.Int.encode(__typed__.amount),
        memo: damlTypes.Text.encode(__typed__.memo),
      };
    },
    Archive: {
      template: function () { return exports.CashTransferOffer; },
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
    Offer_Accept: {
      template: function () { return exports.CashTransferOffer; },
      choiceName: 'Offer_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Offer_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Offer_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).encode(__typed__); },
    },
    Offer_Reject: {
      template: function () { return exports.CashTransferOffer; },
      choiceName: 'Offer_Reject',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Offer_Reject.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Offer_Reject.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).encode(__typed__); },
    },
    Offer_Withdraw: {
      template: function () { return exports.CashTransferOffer; },
      choiceName: 'Offer_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Offer_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Offer_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CashTransferOffer, ['9f73ecb7e400a6e765089b22559075387de3706d509cf03668d5c82aa472d08f', '#abu-pm-seat']);

exports.Offer_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Offer_Reject = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Offer_Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.TransferDesk = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-seat:PM.Seat.Send:TransferDesk',
    templateIdWithPackageId: '#9f73ecb7e400a6e765089b22559075387de3706d509cf03668d5c82aa472d08f:PM.Seat.Send:TransferDesk',
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
      template: function () { return exports.TransferDesk; },
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
    TransferDesk_Offer: {
      template: function () { return exports.TransferDesk; },
      choiceName: 'TransferDesk_Offer',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.TransferDesk_Offer.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.TransferDesk_Offer.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.CashTransferOffer), damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.CashTransferOffer), damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash))).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.TransferDesk, ['9f73ecb7e400a6e765089b22559075387de3706d509cf03668d5c82aa472d08f', '#abu-pm-seat']);

exports.TransferDesk_Offer = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      sender: damlTypes.Party.decoder,
      receiver: damlTypes.Party.decoder,
      cash: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder,
      amount: damlTypes.Int.decoder,
      memo: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      sender: damlTypes.Party.encode(__typed__.sender),
      receiver: damlTypes.Party.encode(__typed__.receiver),
      cash: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__.cash),
      amount: damlTypes.Int.encode(__typed__.amount),
      memo: damlTypes.Text.encode(__typed__.memo),
    };
  },
};
