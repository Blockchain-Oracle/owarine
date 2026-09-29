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
var PM_Market = require('../../PM/Market/module');
var PM_Money = require('../../PM/Money/module');
var PM_Types = require('../../PM/Types/module');

exports.BuyQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Quote:BuyQuote',
    templateIdWithPackageId: '#8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d:PM.Quote:BuyQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        user: damlTypes.Party.decoder,
        legCid: damlTypes.ContractId(PM_Leg.Leg).decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        pairId: damlTypes.Text.decoder,
        outcome: PM_Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        priceTicks: damlTypes.Int.decoder,
        locked: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        user: damlTypes.Party.encode(__typed__.user),
        legCid: damlTypes.ContractId(PM_Leg.Leg).encode(__typed__.legCid),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        outcome: PM_Types.Side.encode(__typed__.outcome),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        locked: damlTypes.Int.encode(__typed__.locked),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
      };
    },
    Archive: {
      template: function () { return exports.BuyQuote; },
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
    BuyQuote_Accept: {
      template: function () { return exports.BuyQuote; },
      choiceName: 'BuyQuote_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BuyQuote_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BuyQuote_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(PM_Money.VenueCash), damlTypes.ContractId(PM_Leg.Leg), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(PM_Money.VenueCash), damlTypes.ContractId(PM_Leg.Leg), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    BuyQuote_Expire: {
      template: function () { return exports.BuyQuote; },
      choiceName: 'BuyQuote_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BuyQuote_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BuyQuote_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
    BuyQuote_Withdraw: {
      template: function () { return exports.BuyQuote; },
      choiceName: 'BuyQuote_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BuyQuote_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BuyQuote_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BuyQuote, ['8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d', '#abu-pm-main']);

exports.BuyQuote_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.BuyQuote_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.BuyQuote_Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      reason: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      reason: damlTypes.Text.encode(__typed__.reason),
    };
  },
};

exports.Desk_IssueBuyQuote = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).decoder,
      legCid: damlTypes.ContractId(PM_Leg.Leg).decoder,
      priceTicks: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
      sellLots: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__.shardCid),
      legCid: damlTypes.ContractId(PM_Leg.Leg).encode(__typed__.legCid),
      priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
      sellLots: damlTypes.Optional(damlTypes.Int).encode(__typed__.sellLots),
    };
  },
};

exports.Desk_IssueQuote = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).decoder,
      user: damlTypes.Party.decoder,
      termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
      pairId: damlTypes.Text.decoder,
      side: PM_Types.Side.decoder,
      priceTicks: damlTypes.Int.decoder,
      lots: damlTypes.Int.decoder,
      fee: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__.shardCid),
      user: damlTypes.Party.encode(__typed__.user),
      termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
      pairId: damlTypes.Text.encode(__typed__.pairId),
      side: PM_Types.Side.encode(__typed__.side),
      priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
      lots: damlTypes.Int.encode(__typed__.lots),
      fee: damlTypes.Int.encode(__typed__.fee),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Desk_IssueTwoWay = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).decoder,
      user: damlTypes.Party.decoder,
      termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
      buyPairId: damlTypes.Text.decoder,
      sellPairId: damlTypes.Text.decoder,
      bidTicks: damlTypes.Int.decoder,
      askTicks: damlTypes.Int.decoder,
      lots: damlTypes.Int.decoder,
      buyFee: damlTypes.Int.decoder,
      sellFee: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__.shardCid),
      user: damlTypes.Party.encode(__typed__.user),
      termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
      buyPairId: damlTypes.Text.encode(__typed__.buyPairId),
      sellPairId: damlTypes.Text.encode(__typed__.sellPairId),
      bidTicks: damlTypes.Int.encode(__typed__.bidTicks),
      askTicks: damlTypes.Int.encode(__typed__.askTicks),
      lots: damlTypes.Int.encode(__typed__.lots),
      buyFee: damlTypes.Int.encode(__typed__.buyFee),
      sellFee: damlTypes.Int.encode(__typed__.sellFee),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Desk_SettleBatch = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      legCids: damlTypes.List(damlTypes.ContractId(PM_Leg.Leg)).decoder,
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      legCids: damlTypes.List(damlTypes.ContractId(PM_Leg.Leg)).encode(__typed__.legCids),
      resolutionCid: damlTypes.ContractId(PM_Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Quote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Quote:Quote',
    templateIdWithPackageId: '#8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d:PM.Quote:Quote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        user: damlTypes.Party.decoder,
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        side: PM_Types.Side.decoder,
        priceTicks: damlTypes.Int.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        fee: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
        lockAt: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        user: damlTypes.Party.encode(__typed__.user),
        termsCid: damlTypes.ContractId(PM_Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        side: PM_Types.Side.encode(__typed__.side),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        fee: damlTypes.Int.encode(__typed__.fee),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
      };
    },
    Archive: {
      template: function () { return exports.Quote; },
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
    Quote_Accept: {
      template: function () { return exports.Quote; },
      choiceName: 'Quote_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Quote_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Quote_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(PM_Leg.Leg), damlTypes.ContractId(PM_Leg.Leg), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(PM_Leg.Leg), damlTypes.ContractId(PM_Leg.Leg), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Quote_Expire: {
      template: function () { return exports.Quote; },
      choiceName: 'Quote_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Quote_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Quote_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
    Quote_Withdraw: {
      template: function () { return exports.Quote; },
      choiceName: 'Quote_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Quote_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Quote_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.Quote, ['8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d', '#abu-pm-main']);

exports.Quote_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).decoder,
      beneficiaryRef: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.cash),
      beneficiaryRef: damlTypes.Optional(damlTypes.Text).encode(__typed__.beneficiaryRef),
    };
  },
};

exports.Quote_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Quote_Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      reason: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      reason: damlTypes.Text.encode(__typed__.reason),
    };
  },
};

exports.SettleBatchResult = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      payouts: damlTypes.List(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder,
      fees: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      payouts: damlTypes.List(damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__.payouts),
      fees: damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.fees),
    };
  },
};

exports.VenueDesk = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Quote:VenueDesk',
    templateIdWithPackageId: '#8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d:PM.Quote:VenueDesk',
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
      template: function () { return exports.VenueDesk; },
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
    Desk_IssueBuyQuote: {
      template: function () { return exports.VenueDesk; },
      choiceName: 'Desk_IssueBuyQuote',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Desk_IssueBuyQuote.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Desk_IssueBuyQuote.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.BuyQuote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.BuyQuote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Desk_IssueQuote: {
      template: function () { return exports.VenueDesk; },
      choiceName: 'Desk_IssueQuote',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Desk_IssueQuote.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Desk_IssueQuote.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Quote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Quote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Desk_IssueTwoWay: {
      template: function () { return exports.VenueDesk; },
      choiceName: 'Desk_IssueTwoWay',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Desk_IssueTwoWay.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Desk_IssueTwoWay.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.Quote), damlTypes.ContractId(exports.Quote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.Quote), damlTypes.ContractId(exports.Quote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Desk_SettleBatch: {
      template: function () { return exports.VenueDesk; },
      choiceName: 'Desk_SettleBatch',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Desk_SettleBatch.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Desk_SettleBatch.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return exports.SettleBatchResult.decoder;
      }),
      resultEncode: function (__typed__) { return exports.SettleBatchResult.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.VenueDesk, ['8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d', '#abu-pm-main']);
