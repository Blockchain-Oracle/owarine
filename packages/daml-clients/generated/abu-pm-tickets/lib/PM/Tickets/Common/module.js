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

var pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794 = require('@daml.js/abu-pm-main-0.3.0');

exports.Paid = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      toOwner: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).decoder),
      toReserve: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      toOwner: damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).encode(__typed__.toOwner),
      toReserve: damlTypes.Optional(damlTypes.ContractId(pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash)).encode(__typed__.toReserve),
    };
  },
};
