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

var pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c = require('@daml.js/abu-pm-main-0.5.0');
var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@daml.js/daml-prim-DA-Types-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

var PM_Tickets_Common = require('../../../PM/Tickets/Common/module');

exports.BoostExitQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Boost:BoostExitQuote',
    templateIdWithPackageId: '#a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8:PM.Tickets.Boost:BoostExitQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        user: damlTypes.Party.decoder,
        positionCid: damlTypes.ContractId(exports.BoostPosition).decoder,
        pairId: damlTypes.Text.decoder,
        exitTicks: damlTypes.Int.decoder,
        proceeds: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        user: damlTypes.Party.encode(__typed__.user),
        positionCid: damlTypes.ContractId(exports.BoostPosition).encode(__typed__.positionCid),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        exitTicks: damlTypes.Int.encode(__typed__.exitTicks),
        proceeds: damlTypes.Int.encode(__typed__.proceeds),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
      };
    },
    Archive: {
      template: function () { return exports.BoostExitQuote; },
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
    BoostExit_Accept: {
      template: function () { return exports.BoostExitQuote; },
      choiceName: 'BoostExit_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BoostExit_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BoostExit_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(PM_Tickets_Common.Paid, damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(PM_Tickets_Common.Paid, damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg)).encode(__typed__); },
    },
    BoostExit_Expire: {
      template: function () { return exports.BoostExitQuote; },
      choiceName: 'BoostExit_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BoostExit_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BoostExit_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).encode(__typed__); },
    },
    BoostExit_Withdraw: {
      template: function () { return exports.BoostExitQuote; },
      choiceName: 'BoostExit_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BoostExit_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BoostExit_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BoostExitQuote, ['a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8', '#abu-pm-tickets']);

exports.BoostExit_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.BoostExit_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.BoostExit_Withdraw = {
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

exports.BoostPosition = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Boost:BoostPosition',
    templateIdWithPackageId: '#a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8:PM.Tickets.Boost:BoostPosition',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.decoder,
        priceTicks: damlTypes.Int.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        leverageBps: damlTypes.Int.decoder,
        stake: damlTypes.Int.decoder,
        fronted: damlTypes.Int.decoder,
        premium: damlTypes.Int.decoder,
        barrierE8: damlTypes.Int.decoder,
        barrierFrom: damlTypes.Time.decoder,
        knockOutProceeds: damlTypes.Int.decoder,
        lockAt: damlTypes.Time.decoder,
        expiry: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        termsCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.encode(__typed__.side),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        leverageBps: damlTypes.Int.encode(__typed__.leverageBps),
        stake: damlTypes.Int.encode(__typed__.stake),
        fronted: damlTypes.Int.encode(__typed__.fronted),
        premium: damlTypes.Int.encode(__typed__.premium),
        barrierE8: damlTypes.Int.encode(__typed__.barrierE8),
        barrierFrom: damlTypes.Time.encode(__typed__.barrierFrom),
        knockOutProceeds: damlTypes.Int.encode(__typed__.knockOutProceeds),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        expiry: damlTypes.Time.encode(__typed__.expiry),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
      };
    },
    Archive: {
      template: function () { return exports.BoostPosition; },
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
    Boost_Claim: {
      template: function () { return exports.BoostPosition; },
      choiceName: 'Boost_Claim',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Boost_Claim.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Boost_Claim.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
    Boost_KnockOut: {
      template: function () { return exports.BoostPosition; },
      choiceName: 'Boost_KnockOut',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Boost_KnockOut.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Boost_KnockOut.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(PM_Tickets_Common.Paid, damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg), damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(PM_Tickets_Common.Paid, damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg), damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).encode(__typed__); },
    },
    Boost_OfferExit: {
      template: function () { return exports.BoostPosition; },
      choiceName: 'Boost_OfferExit',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Boost_OfferExit.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Boost_OfferExit.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.BoostExitQuote), damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.BoostExitQuote), damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).encode(__typed__); },
    },
    Boost_RefundStale: {
      template: function () { return exports.BoostPosition; },
      choiceName: 'Boost_RefundStale',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Boost_RefundStale.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Boost_RefundStale.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
    Boost_Settle: {
      template: function () { return exports.BoostPosition; },
      choiceName: 'Boost_Settle',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Boost_Settle.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Boost_Settle.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BoostPosition, ['a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8', '#abu-pm-tickets']);

exports.BoostQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Boost:BoostQuote',
    templateIdWithPackageId: '#a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8:PM.Tickets.Boost:BoostQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        user: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        termsCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.MarketTerms).decoder,
        marketId: damlTypes.Text.decoder,
        pairId: damlTypes.Text.decoder,
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.decoder,
        priceTicks: damlTypes.Int.decoder,
        lots: damlTypes.Int.decoder,
        cashUnit: damlTypes.Int.decoder,
        leverageBps: damlTypes.Int.decoder,
        stake: damlTypes.Int.decoder,
        fronted: damlTypes.Int.decoder,
        premium: damlTypes.Int.decoder,
        barrierE8: damlTypes.Int.decoder,
        knockOutProceeds: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
        lockAt: damlTypes.Time.decoder,
        expiry: damlTypes.Time.decoder,
        refundAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        user: damlTypes.Party.encode(__typed__.user),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        termsCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.MarketTerms).encode(__typed__.termsCid),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        pairId: damlTypes.Text.encode(__typed__.pairId),
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.encode(__typed__.side),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        lots: damlTypes.Int.encode(__typed__.lots),
        cashUnit: damlTypes.Int.encode(__typed__.cashUnit),
        leverageBps: damlTypes.Int.encode(__typed__.leverageBps),
        stake: damlTypes.Int.encode(__typed__.stake),
        fronted: damlTypes.Int.encode(__typed__.fronted),
        premium: damlTypes.Int.encode(__typed__.premium),
        barrierE8: damlTypes.Int.encode(__typed__.barrierE8),
        knockOutProceeds: damlTypes.Int.encode(__typed__.knockOutProceeds),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
        lockAt: damlTypes.Time.encode(__typed__.lockAt),
        expiry: damlTypes.Time.encode(__typed__.expiry),
        refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
      };
    },
    Archive: {
      template: function () { return exports.BoostQuote; },
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
    BoostQuote_Accept: {
      template: function () { return exports.BoostQuote; },
      choiceName: 'BoostQuote_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BoostQuote_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BoostQuote_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.BoostPosition), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg), damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.BoostPosition), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg), damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash))).encode(__typed__); },
    },
    BoostQuote_Expire: {
      template: function () { return exports.BoostQuote; },
      choiceName: 'BoostQuote_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BoostQuote_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BoostQuote_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
    BoostQuote_Withdraw: {
      template: function () { return exports.BoostQuote; },
      choiceName: 'BoostQuote_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BoostQuote_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BoostQuote_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BoostQuote, ['a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8', '#abu-pm-tickets']);

exports.BoostQuote_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.BoostQuote_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.BoostQuote_Withdraw = {
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

exports.Boost_Claim = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Boost_KnockOut = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      observedAt: damlTypes.Time.decoder,
      quoteCids: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Oracle.PriceQuote)).decoder,
      shardCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      observedAt: damlTypes.Time.encode(__typed__.observedAt),
      quoteCids: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Oracle.PriceQuote)).encode(__typed__.quoteCids),
      shardCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).encode(__typed__.shardCid),
    };
  },
};

exports.Boost_OfferExit = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      shardCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).decoder,
      exitTicks: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      shardCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash).encode(__typed__.shardCid),
      exitTicks: damlTypes.Int.encode(__typed__.exitTicks),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Boost_RefundStale = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Boost_Settle = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};
