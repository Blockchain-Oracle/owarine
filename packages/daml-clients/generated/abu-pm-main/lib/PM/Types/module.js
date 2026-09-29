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

exports.PolicyVersion = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      version: damlTypes.Int.decoder,
      effectiveFrom: damlTypes.Time.decoder,
      validUntil: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Time).decoder),
      printSource: damlTypes.Text.decoder,
      minDelaySec: damlTypes.Int.decoder,
      barLenSec: damlTypes.Int.decoder,
      openAdmissionSec: damlTypes.Int.decoder,
      closeAdmissionSec: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      version: damlTypes.Int.encode(__typed__.version),
      effectiveFrom: damlTypes.Time.encode(__typed__.effectiveFrom),
      validUntil: damlTypes.Optional(damlTypes.Time).encode(__typed__.validUntil),
      printSource: damlTypes.Text.encode(__typed__.printSource),
      minDelaySec: damlTypes.Int.encode(__typed__.minDelaySec),
      barLenSec: damlTypes.Int.encode(__typed__.barLenSec),
      openAdmissionSec: damlTypes.Int.encode(__typed__.openAdmissionSec),
      closeAdmissionSec: damlTypes.Int.encode(__typed__.closeAdmissionSec),
    };
  },
};

exports.Side = {
  SideUp: 'SideUp',
  SideDown: 'SideDown',
  keys: ['SideUp', 'SideDown'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.Side.SideUp),
      jtv.constant(exports.Side.SideDown),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.Slot = {
  OpenSlot: 'OpenSlot',
  CloseSlot: 'CloseSlot',
  keys: ['OpenSlot', 'CloseSlot'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.Slot.OpenSlot),
      jtv.constant(exports.Slot.CloseSlot),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.VoidReason = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("MissingPrint"),
        value: exports.VoidReason.MissingPrint.decoder,
      }),
      jtv.object({
        tag: jtv.constant("QuorumNotMet"),
        value: exports.VoidReason.QuorumNotMet.decoder,
      }),
      jtv.object({
        tag: jtv.constant("ResolverAbsent"),
        value: exports.VoidReason.ResolverAbsent.decoder,
      }),
      jtv.object({
        tag: jtv.constant("SourceDisagreement"),
        value: exports.VoidReason.SourceDisagreement.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'MissingPrint': return {tag: __typed__.tag, value: exports.VoidReason.MissingPrint.encode(__typed__.value)};
      case 'QuorumNotMet': return {tag: __typed__.tag, value: exports.VoidReason.QuorumNotMet.encode(__typed__.value)};
      case 'ResolverAbsent': return {tag: __typed__.tag, value: exports.VoidReason.ResolverAbsent.encode(__typed__.value)};
      case 'SourceDisagreement': return {tag: __typed__.tag, value: exports.VoidReason.SourceDisagreement.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type VoidReason';
    }
  },
  MissingPrint: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        slot: exports.Slot.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        slot: exports.Slot.encode(__typed__.slot),
      };
    },
  },
  QuorumNotMet: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        slot: exports.Slot.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        slot: exports.Slot.encode(__typed__.slot),
      };
    },
  },
  ResolverAbsent: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        slot: exports.Slot.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        slot: exports.Slot.encode(__typed__.slot),
      };
    },
  },
  SourceDisagreement: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        slot: exports.Slot.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        slot: exports.Slot.encode(__typed__.slot),
      };
    },
  },
};
