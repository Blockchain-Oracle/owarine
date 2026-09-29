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
var pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d = require('@daml.js/abu-pm-main-0.4.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

exports.GrantDesk = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Vault:GrantDesk',
    templateIdWithPackageId: '#a2b126b654d6836e81e5a6bc32552467d40c6def21ecc47e15b71644354ff379:PM.Agents.Vault:GrantDesk',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
      };
    },
    Archive: {
      template: function () { return exports.GrantDesk; },
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
    GrantDesk_Fund: {
      template: function () { return exports.GrantDesk; },
      choiceName: 'GrantDesk_Fund',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.GrantDesk_Fund.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.GrantDesk_Fund.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.AgentGrant).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.AgentGrant).encode(__typed__); },
    },
    GrantDesk_Open: {
      template: function () { return exports.GrantDesk; },
      choiceName: 'GrantDesk_Open',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.GrantDesk_Open.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.GrantDesk_Open.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.AgentGrant), damlTypes.Optional(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.AgentGrant), damlTypes.Optional(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash))).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.GrantDesk, ['a2b126b654d6836e81e5a6bc32552467d40c6def21ecc47e15b71644354ff379', '#abu-pm-agents']);

exports.GrantDesk_Fund = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      grantCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.AgentGrant).decoder,
      cash: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      grantCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.AgentGrant).encode(__typed__.grantCid),
      cash: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.GrantDesk_Open = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      agent: damlTypes.Party.decoder,
      caps: pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.GrantCaps.decoder,
      expiresAt: damlTypes.Time.decoder,
      dayZero: damlTypes.Time.decoder,
      budget: damlTypes.Int.decoder,
      cash: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      agent: damlTypes.Party.encode(__typed__.agent),
      caps: pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Grant.GrantCaps.encode(__typed__.caps),
      expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      dayZero: damlTypes.Time.encode(__typed__.dayZero),
      budget: damlTypes.Int.encode(__typed__.budget),
      cash: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};
