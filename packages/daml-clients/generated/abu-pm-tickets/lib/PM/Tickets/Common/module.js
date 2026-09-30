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

var pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c = require('@daml.js/abu-pm-main-0.5.0');

exports.Paid = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      toOwner: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).decoder),
      toReserve: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      toOwner: damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).encode(__typed__.toOwner),
      toReserve: damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).encode(__typed__.toReserve),
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
      outcome: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side.decoder,
      resolved: jtv.Decoder.withDefault(null, damlTypes.Optional(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side).decoder),
      lots: damlTypes.Int.decoder,
      cashUnit: damlTypes.Int.decoder,
      backingShare: damlTypes.Int.decoder,
      cost: damlTypes.Int.decoder,
      payout: damlTypes.Int.decoder,
      fee: damlTypes.Int.decoder,
      detail: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Publication.ReceiptDetail.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      venue: damlTypes.Party.encode(__typed__.venue),
      owner: damlTypes.Party.encode(__typed__.owner),
      product: damlTypes.Text.encode(__typed__.product),
      marketId: damlTypes.Text.encode(__typed__.marketId),
      pairId: damlTypes.Text.encode(__typed__.pairId),
      outcome: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side.encode(__typed__.outcome),
      resolved: damlTypes.Optional(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side).encode(__typed__.resolved),
      lots: damlTypes.Int.encode(__typed__.lots),
      cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
      backingShare: damlTypes.Int.encode(__typed__.backingShare),
      cost: damlTypes.Int.encode(__typed__.cost),
      payout: damlTypes.Int.encode(__typed__.payout),
      fee: damlTypes.Int.encode(__typed__.fee),
      detail: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Publication.ReceiptDetail.encode(__typed__.detail),
    };
  },
};
