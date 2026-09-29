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

var PM_Market = require('../../PM/Market/module');
var PM_Types = require('../../PM/Types/module');

exports.Series = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Series:Series',
    templateIdWithPackageId: '#2359d13841214bda7b42529ffdb6e99fb4fff907648552fb27e25ec6f044deef:PM.Series:Series',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        seriesKey: damlTypes.Text.decoder,
        symbol: damlTypes.Text.decoder,
        anchor: damlTypes.Time.decoder,
        cadenceSec: damlTypes.Int.decoder,
        lockLeadSec: damlTypes.Int.decoder,
        settleGraceSec: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        nextIndex: damlTypes.Int.decoder,
        oracles: damlTypes.List(damlTypes.Party).decoder,
        quorum: damlTypes.Int.decoder,
        maxDeviationBps: damlTypes.Int.decoder,
        policyVersions: damlTypes.List(PM_Types.PolicyVersion).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        seriesKey: damlTypes.Text.encode(__typed__.seriesKey),
        symbol: damlTypes.Text.encode(__typed__.symbol),
        anchor: damlTypes.Time.encode(__typed__.anchor),
        cadenceSec: damlTypes.Int.encode(__typed__.cadenceSec),
        lockLeadSec: damlTypes.Int.encode(__typed__.lockLeadSec),
        settleGraceSec: damlTypes.Int.encode(__typed__.settleGraceSec),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        nextIndex: damlTypes.Int.encode(__typed__.nextIndex),
        oracles: damlTypes.List(damlTypes.Party).encode(__typed__.oracles),
        quorum: damlTypes.Int.encode(__typed__.quorum),
        maxDeviationBps: damlTypes.Int.encode(__typed__.maxDeviationBps),
        policyVersions: damlTypes.List(PM_Types.PolicyVersion).encode(__typed__.policyVersions),
      };
    },
    Archive: {
      template: function () { return exports.Series; },
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
    Series_AddPolicyVersion: {
      template: function () { return exports.Series; },
      choiceName: 'Series_AddPolicyVersion',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Series_AddPolicyVersion.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Series_AddPolicyVersion.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.Series).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.Series).encode(__typed__); },
    },
    Series_OpenWindow: {
      template: function () { return exports.Series; },
      choiceName: 'Series_OpenWindow',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Series_OpenWindow.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Series_OpenWindow.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.Series), damlTypes.ContractId(PM_Market.MarketTerms), damlTypes.ContractId(PM_Market.WindowState)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.Series), damlTypes.ContractId(PM_Market.MarketTerms), damlTypes.ContractId(PM_Market.WindowState)).encode(__typed__); },
    },
    Series_SkipTo: {
      template: function () { return exports.Series; },
      choiceName: 'Series_SkipTo',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Series_SkipTo.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Series_SkipTo.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.Series).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.Series).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.Series, ['2359d13841214bda7b42529ffdb6e99fb4fff907648552fb27e25ec6f044deef', '#abu-pm-main']);

exports.Series_AddPolicyVersion = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      pv: PM_Types.PolicyVersion.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      pv: PM_Types.PolicyVersion.encode(__typed__.pv),
    };
  },
};

exports.Series_OpenWindow = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      index: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      index: damlTypes.Int.encode(__typed__.index),
    };
  },
};

exports.Series_SkipTo = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      toIndex: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      toIndex: damlTypes.Int.encode(__typed__.toIndex),
    };
  },
};
