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

var PM_Tickets_Boost = require('../../../PM/Tickets/Boost/module');
var PM_Tickets_Parlay = require('../../../PM/Tickets/Parlay/module');
var PM_Tickets_Range = require('../../../PM/Tickets/Range/module');

exports.EarnDesk = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Earn:EarnDesk',
    templateIdWithPackageId: '#f5a944b16b225d2a28b847fc165b20f3b23b6fcaace4a66a11186788a74fb56d:PM.Tickets.Earn:EarnDesk',
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
      template: function () { return exports.EarnDesk; },
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
    Earn_IssueWithdraw: {
      template: function () { return exports.EarnDesk; },
      choiceName: 'Earn_IssueWithdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Earn_IssueWithdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Earn_IssueWithdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.WithdrawQuote), damlTypes.Optional(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.WithdrawQuote), damlTypes.Optional(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash))).encode(__typed__); },
    },
    Earn_PublishNav: {
      template: function () { return exports.EarnDesk; },
      choiceName: 'Earn_PublishNav',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Earn_PublishNav.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Earn_PublishNav.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.NavStatement).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.NavStatement).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.EarnDesk, ['f5a944b16b225d2a28b847fc165b20f3b23b6fcaace4a66a11186788a74fb56d', '#abu-pm-tickets']);

exports.Earn_IssueWithdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      navCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.NavStatement).decoder,
      provider: damlTypes.Party.decoder,
      lpShareCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.LpShare).decoder,
      sharesIn: damlTypes.Int.decoder,
      shardCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash).decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      navCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.NavStatement).encode(__typed__.navCid),
      provider: damlTypes.Party.encode(__typed__.provider),
      lpShareCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.LpShare).encode(__typed__.lpShareCid),
      sharesIn: damlTypes.Int.encode(__typed__.sharesIn),
      shardCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash).encode(__typed__.shardCid),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Earn_PublishNav = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      navCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.NavStatement).decoder,
      asOf: damlTypes.Time.decoder,
      inputs: exports.NavInputs.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      navCid: damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.NavStatement).encode(__typed__.navCid),
      asOf: damlTypes.Time.encode(__typed__.asOf),
      inputs: exports.NavInputs.encode(__typed__.inputs),
    };
  },
};

exports.NavInputs = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash)).decoder,
      lpShares: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.LpShare)).decoder,
      withdrawQuotes: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.WithdrawQuote)).decoder,
      rangeQuotes: damlTypes.List(damlTypes.ContractId(PM_Tickets_Range.RangeQuote)).decoder,
      rounds: damlTypes.List(damlTypes.ContractId(PM_Tickets_Range.RangeRound)).decoder,
      parlayQuotes: damlTypes.List(damlTypes.ContractId(PM_Tickets_Parlay.ParlayQuote)).decoder,
      tickets: damlTypes.List(damlTypes.ContractId(PM_Tickets_Parlay.ParlayTicket)).decoder,
      boostQuotes: damlTypes.List(damlTypes.ContractId(PM_Tickets_Boost.BoostQuote)).decoder,
      positions: damlTypes.List(damlTypes.ContractId(PM_Tickets_Boost.BoostPosition)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash)).encode(__typed__.cash),
      lpShares: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.LpShare)).encode(__typed__.lpShares),
      withdrawQuotes: damlTypes.List(damlTypes.ContractId(pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Reserve.WithdrawQuote)).encode(__typed__.withdrawQuotes),
      rangeQuotes: damlTypes.List(damlTypes.ContractId(PM_Tickets_Range.RangeQuote)).encode(__typed__.rangeQuotes),
      rounds: damlTypes.List(damlTypes.ContractId(PM_Tickets_Range.RangeRound)).encode(__typed__.rounds),
      parlayQuotes: damlTypes.List(damlTypes.ContractId(PM_Tickets_Parlay.ParlayQuote)).encode(__typed__.parlayQuotes),
      tickets: damlTypes.List(damlTypes.ContractId(PM_Tickets_Parlay.ParlayTicket)).encode(__typed__.tickets),
      boostQuotes: damlTypes.List(damlTypes.ContractId(PM_Tickets_Boost.BoostQuote)).encode(__typed__.boostQuotes),
      positions: damlTypes.List(damlTypes.ContractId(PM_Tickets_Boost.BoostPosition)).encode(__typed__.positions),
    };
  },
};
