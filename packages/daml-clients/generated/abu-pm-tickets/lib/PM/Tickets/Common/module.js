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

var pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550 = require('@daml.js/abu-pm-main-0.5.0');

exports.Paid = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      toOwner: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash)).decoder),
      toReserve: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      toOwner: damlTypes.Optional(damlTypes.ContractId(pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash)).encode(__typed__.toOwner),
      toReserve: damlTypes.Optional(damlTypes.ContractId(pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash)).encode(__typed__.toReserve),
    };
  },
};

exports.TicketReceipt = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      venue: damlTypes.Party.decoder,
      owner: damlTypes.Party.decoder,
      product: damlTypes.Text.decoder,
      marketId: damlTypes.Text.decoder,
      pairId: damlTypes.Text.decoder,
      outcome: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Types.Side.decoder,
      resolved: jtv.Decoder.withDefault(null, damlTypes.Optional(pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Types.Side).decoder),
      lots: damlTypes.Int.decoder,
      cashUnit: damlTypes.Int.decoder,
      backingShare: damlTypes.Int.decoder,
      cost: damlTypes.Int.decoder,
      payout: damlTypes.Int.decoder,
      fee: damlTypes.Int.decoder,
      detail: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Publication.ReceiptDetail.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      venue: damlTypes.Party.encode(__typed__.venue),
      owner: damlTypes.Party.encode(__typed__.owner),
      product: damlTypes.Text.encode(__typed__.product),
      marketId: damlTypes.Text.encode(__typed__.marketId),
      pairId: damlTypes.Text.encode(__typed__.pairId),
      outcome: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Types.Side.encode(__typed__.outcome),
      resolved: damlTypes.Optional(pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Types.Side).encode(__typed__.resolved),
      lots: damlTypes.Int.encode(__typed__.lots),
      cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
      backingShare: damlTypes.Int.encode(__typed__.backingShare),
      cost: damlTypes.Int.encode(__typed__.cost),
      payout: damlTypes.Int.encode(__typed__.payout),
      fee: damlTypes.Int.encode(__typed__.fee),
      detail: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Publication.ReceiptDetail.encode(__typed__.detail),
    };
  },
};
