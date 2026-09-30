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

var PM_Leg = require('../../PM/Leg/module');
var PM_Money = require('../../PM/Money/module');
var PM_Quote = require('../../PM/Quote/module');
var PM_Types = require('../../PM/Types/module');

exports.AgentGrant = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Grant:AgentGrant',
    templateIdWithPackageId: '#ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550:PM.Grant:AgentGrant',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        agent: damlTypes.Party.decoder,
        caps: exports.GrantCaps.decoder,
        budget: damlTypes.Int.decoder,
        expiresAt: damlTypes.Time.decoder,
        dayZero: damlTypes.Time.decoder,
        day: damlTypes.Int.decoder,
        spentToday: damlTypes.Int.decoder,
        positions: damlTypes.List(exports.GrantPosition).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        agent: damlTypes.Party.encode(__typed__.agent),
        caps: exports.GrantCaps.encode(__typed__.caps),
        budget: damlTypes.Int.encode(__typed__.budget),
        expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
        dayZero: damlTypes.Time.encode(__typed__.dayZero),
        day: damlTypes.Int.encode(__typed__.day),
        spentToday: damlTypes.Int.encode(__typed__.spentToday),
        positions: damlTypes.List(exports.GrantPosition).encode(__typed__.positions),
      };
    },
    Archive: {
      template: function () { return exports.AgentGrant; },
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
    Grant_AcceptQuote: {
      template: function () { return exports.AgentGrant; },
      choiceName: 'Grant_AcceptQuote',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Grant_AcceptQuote.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Grant_AcceptQuote.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.AgentGrant), damlTypes.ContractId(PM_Leg.Leg)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.AgentGrant), damlTypes.ContractId(PM_Leg.Leg)).encode(__typed__); },
    },
    Grant_Revoke: {
      template: function () { return exports.AgentGrant; },
      choiceName: 'Grant_Revoke',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Grant_Revoke.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Grant_Revoke.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.AgentGrant, ['ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550', '#abu-pm-main']);

exports.CapInput = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      caps: exports.GrantCaps.decoder,
      budget: damlTypes.Int.decoder,
      spentToday: damlTypes.Int.decoder,
      openPositions: damlTypes.Int.decoder,
      opensNewPosition: damlTypes.Bool.decoder,
      limitTicks: damlTypes.Int.decoder,
      priceTicks: damlTypes.Int.decoder,
      lots: damlTypes.Int.decoder,
      cashUnit: damlTypes.Int.decoder,
      fee: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      caps: exports.GrantCaps.encode(__typed__.caps),
      budget: damlTypes.Int.encode(__typed__.budget),
      spentToday: damlTypes.Int.encode(__typed__.spentToday),
      openPositions: damlTypes.Int.encode(__typed__.openPositions),
      opensNewPosition: damlTypes.Bool.encode(__typed__.opensNewPosition),
      limitTicks: damlTypes.Int.encode(__typed__.limitTicks),
      priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
      lots: damlTypes.Int.encode(__typed__.lots),
      cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
      fee: damlTypes.Int.encode(__typed__.fee),
    };
  },
};

exports.GrantCaps = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      maxStakePerTrade: damlTypes.Int.decoder,
      maxDailySpend: damlTypes.Int.decoder,
      maxPriceTicks: damlTypes.Int.decoder,
      maxOpenPositions: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      maxStakePerTrade: damlTypes.Int.encode(__typed__.maxStakePerTrade),
      maxDailySpend: damlTypes.Int.encode(__typed__.maxDailySpend),
      maxPriceTicks: damlTypes.Int.encode(__typed__.maxPriceTicks),
      maxOpenPositions: damlTypes.Int.encode(__typed__.maxOpenPositions),
    };
  },
};

exports.GrantOffer = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Grant:GrantOffer',
    templateIdWithPackageId: '#ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550:PM.Grant:GrantOffer',
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
      template: function () { return exports.GrantOffer; },
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
    GrantOffer_Open: {
      template: function () { return exports.GrantOffer; },
      choiceName: 'GrantOffer_Open',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.GrantOffer_Open.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.GrantOffer_Open.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.AgentGrant).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.AgentGrant).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.GrantOffer, ['ceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550', '#abu-pm-main']);

exports.GrantOffer_Open = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      agent: damlTypes.Party.decoder,
      caps: exports.GrantCaps.decoder,
      expiresAt: damlTypes.Time.decoder,
      dayZero: damlTypes.Time.decoder,
      budget: damlTypes.Int.decoder,
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      agent: damlTypes.Party.encode(__typed__.agent),
      caps: exports.GrantCaps.encode(__typed__.caps),
      expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      dayZero: damlTypes.Time.encode(__typed__.dayZero),
      budget: damlTypes.Int.encode(__typed__.budget),
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.GrantPosition = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      marketId: damlTypes.Text.decoder,
      outcome: PM_Types.Side.decoder,
      refundAfter: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      marketId: damlTypes.Text.encode(__typed__.marketId),
      outcome: PM_Types.Side.encode(__typed__.outcome),
      refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
    };
  },
};

exports.Grant_AcceptQuote = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      quoteCid: damlTypes.ContractId(PM_Quote.Quote).decoder,
      limitTicks: damlTypes.Int.decoder,
      asOf: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      quoteCid: damlTypes.ContractId(PM_Quote.Quote).encode(__typed__.quoteCid),
      limitTicks: damlTypes.Int.encode(__typed__.limitTicks),
      asOf: damlTypes.Time.encode(__typed__.asOf),
    };
  },
};

exports.Grant_Revoke = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
