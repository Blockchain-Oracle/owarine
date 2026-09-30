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

exports.AttestationEvidence = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      attestor: damlTypes.Party.decoder,
      answer: damlTypes.Bool.decoder,
      attestedAt: damlTypes.Time.decoder,
      statementHash: damlTypes.Text.decoder,
      attestationCid: damlTypes.ContractId(exports.EventAttestation).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      attestor: damlTypes.Party.encode(__typed__.attestor),
      answer: damlTypes.Bool.encode(__typed__.answer),
      attestedAt: damlTypes.Time.encode(__typed__.attestedAt),
      statementHash: damlTypes.Text.encode(__typed__.statementHash),
      attestationCid: damlTypes.ContractId(exports.EventAttestation).encode(__typed__.attestationCid),
    };
  },
};

exports.Attestation_Retire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.EventAttestation = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Event:EventAttestation',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Event:EventAttestation',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        attestor: damlTypes.Party.decoder,
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        marketId: damlTypes.Text.decoder,
        answer: damlTypes.Bool.decoder,
        attestedAt: damlTypes.Time.decoder,
        statementHash: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        attestor: damlTypes.Party.encode(__typed__.attestor),
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        answer: damlTypes.Bool.encode(__typed__.answer),
        attestedAt: damlTypes.Time.encode(__typed__.attestedAt),
        statementHash: damlTypes.Text.encode(__typed__.statementHash),
      };
    },
    Archive: {
      template: function () { return exports.EventAttestation; },
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
    Attestation_Retire: {
      template: function () { return exports.EventAttestation; },
      choiceName: 'Attestation_Retire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Attestation_Retire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Attestation_Retire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.EventAttestation, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.EventState = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Event:EventState',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Event:EventState',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
      };
    },
    Archive: {
      template: function () { return exports.EventState; },
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
  },
);

damlTypes.registerTemplate(exports.EventState, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.EventTerms = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Event:EventTerms',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Event:EventTerms',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        question: damlTypes.Text.decoder,
        closeTime: damlTypes.Time.decoder,
        closeDeadline: damlTypes.Time.decoder,
        attestors: damlTypes.List(damlTypes.Party).decoder,
        quorum: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        question: damlTypes.Text.encode(__typed__.question),
        closeTime: damlTypes.Time.encode(__typed__.closeTime),
        closeDeadline: damlTypes.Time.encode(__typed__.closeDeadline),
        attestors: damlTypes.List(damlTypes.Party).encode(__typed__.attestors),
        quorum: damlTypes.Int.encode(__typed__.quorum),
      };
    },
    Archive: {
      template: function () { return exports.EventTerms; },
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
    Event_Resolve: {
      template: function () { return exports.EventTerms; },
      choiceName: 'Event_Resolve',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Event_Resolve.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Event_Resolve.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_Market.Resolution), damlTypes.ContractId(exports.EventVerdict)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_Market.Resolution), damlTypes.ContractId(exports.EventVerdict)).encode(__typed__); },
    },
    Event_Void: {
      template: function () { return exports.EventTerms; },
      choiceName: 'Event_Void',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Event_Void.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Event_Void.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_Market.Resolution), damlTypes.ContractId(exports.EventVerdict)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_Market.Resolution), damlTypes.ContractId(exports.EventVerdict)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.EventTerms, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.EventVerdict = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Event:EventVerdict',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Event:EventVerdict',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        resolver: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        question: damlTypes.Text.decoder,
        answer: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Bool).decoder),
        voidReason: jtv.Decoder.withDefault(null, damlTypes.Optional(PM_Types.VoidReason).decoder),
        attestations: damlTypes.List(exports.AttestationEvidence).decoder,
        resolutionCid: damlTypes.ContractId(PM_Market.Resolution).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        resolver: damlTypes.Party.encode(__typed__.resolver),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        question: damlTypes.Text.encode(__typed__.question),
        answer: damlTypes.Optional(damlTypes.Bool).encode(__typed__.answer),
        voidReason: damlTypes.Optional(PM_Types.VoidReason).encode(__typed__.voidReason),
        attestations: damlTypes.List(exports.AttestationEvidence).encode(__typed__.attestations),
        resolutionCid: damlTypes.ContractId(PM_Market.Resolution).encode(__typed__.resolutionCid),
      };
    },
    Archive: {
      template: function () { return exports.EventVerdict; },
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
  },
);

damlTypes.registerTemplate(exports.EventVerdict, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.Event_Resolve = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      stateCid: damlTypes.ContractId(exports.EventState).decoder,
      attestationCids: damlTypes.List(damlTypes.ContractId(exports.EventAttestation)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      stateCid: damlTypes.ContractId(exports.EventState).encode(__typed__.stateCid),
      attestationCids: damlTypes.List(damlTypes.ContractId(exports.EventAttestation)).encode(__typed__.attestationCids),
    };
  },
};

exports.Event_Void = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      stateCid: damlTypes.ContractId(exports.EventState).decoder,
      attestationCids: damlTypes.List(damlTypes.ContractId(exports.EventAttestation)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      stateCid: damlTypes.ContractId(exports.EventState).encode(__typed__.stateCid),
      attestationCids: damlTypes.List(damlTypes.ContractId(exports.EventAttestation)).encode(__typed__.attestationCids),
    };
  },
};
