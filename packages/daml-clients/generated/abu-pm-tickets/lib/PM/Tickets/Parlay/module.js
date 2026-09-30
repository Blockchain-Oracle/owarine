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
var pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c = require('@daml.js/abu-pm-main-0.5.0');

var PM_Tickets_Common = require('../../../PM/Tickets/Common/module');

exports.ParlayLeg = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      termsCid: damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Market.MarketTerms).decoder,
      marketId: damlTypes.Text.decoder,
      side: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side.decoder,
      expiry: damlTypes.Time.decoder,
      refundAfter: damlTypes.Time.decoder,
      won: damlTypes.Bool.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      termsCid: damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Market.MarketTerms).encode(__typed__.termsCid),
      marketId: damlTypes.Text.encode(__typed__.marketId),
      side: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side.encode(__typed__.side),
      expiry: damlTypes.Time.encode(__typed__.expiry),
      refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
      won: damlTypes.Bool.encode(__typed__.won),
    };
  },
};

exports.ParlayQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Parlay:ParlayQuote',
    templateIdWithPackageId: '#ba653c55a865a2e7141d3cca4f39afa3dbd3329408bc461595337988b2b74b5c:PM.Tickets.Parlay:ParlayQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        user: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        legs: damlTypes.List(exports.ParlayLeg).decoder,
        stake: damlTypes.Int.decoder,
        maxPayout: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
        voidAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        user: damlTypes.Party.encode(__typed__.user),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        legs: damlTypes.List(exports.ParlayLeg).encode(__typed__.legs),
        stake: damlTypes.Int.encode(__typed__.stake),
        maxPayout: damlTypes.Int.encode(__typed__.maxPayout),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
        voidAfter: damlTypes.Time.encode(__typed__.voidAfter),
      };
    },
    Archive: {
      template: function () { return exports.ParlayQuote; },
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
    ParlayQuote_Accept: {
      template: function () { return exports.ParlayQuote; },
      choiceName: 'ParlayQuote_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.ParlayQuote_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.ParlayQuote_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.ParlayTicket), damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.ParlayTicket), damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash))).encode(__typed__); },
    },
    ParlayQuote_Expire: {
      template: function () { return exports.ParlayQuote; },
      choiceName: 'ParlayQuote_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.ParlayQuote_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.ParlayQuote_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).encode(__typed__); },
    },
    ParlayQuote_Withdraw: {
      template: function () { return exports.ParlayQuote; },
      choiceName: 'ParlayQuote_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.ParlayQuote_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.ParlayQuote_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.ParlayQuote, ['ba653c55a865a2e7141d3cca4f39afa3dbd3329408bc461595337988b2b74b5c', '#abu-pm-tickets']);

exports.ParlayQuote_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.ParlayQuote_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.ParlayQuote_Withdraw = {
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

exports.ParlayStep = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("LegWon"),
        value: exports.ParlayStep.LegWon.decoder,
      }),
      jtv.object({
        tag: jtv.constant("TicketWon"),
        value: exports.ParlayStep.TicketWon.decoder,
      }),
      jtv.object({
        tag: jtv.constant("TicketLost"),
        value: exports.ParlayStep.TicketLost.decoder,
      }),
      jtv.object({
        tag: jtv.constant("TicketVoid"),
        value: exports.ParlayStep.TicketVoid.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'LegWon': return {tag: __typed__.tag, value: exports.ParlayStep.LegWon.encode(__typed__.value)};
      case 'TicketWon': return {tag: __typed__.tag, value: exports.ParlayStep.TicketWon.encode(__typed__.value)};
      case 'TicketLost': return {tag: __typed__.tag, value: exports.ParlayStep.TicketLost.encode(__typed__.value)};
      case 'TicketVoid': return {tag: __typed__.tag, value: exports.ParlayStep.TicketVoid.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type ParlayStep';
    }
  },
  LegWon: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        ticketCid: damlTypes.ContractId(exports.ParlayTicket).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        ticketCid: damlTypes.ContractId(exports.ParlayTicket).encode(__typed__.ticketCid),
      };
    },
  },
  TicketLost: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        paid: PM_Tickets_Common.Paid.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        paid: PM_Tickets_Common.Paid.encode(__typed__.paid),
      };
    },
  },
  TicketVoid: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        paid: PM_Tickets_Common.Paid.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        paid: PM_Tickets_Common.Paid.encode(__typed__.paid),
      };
    },
  },
  TicketWon: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        paid: PM_Tickets_Common.Paid.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        paid: PM_Tickets_Common.Paid.encode(__typed__.paid),
      };
    },
  },
};

exports.ParlayTicket = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-tickets:PM.Tickets.Parlay:ParlayTicket',
    templateIdWithPackageId: '#ba653c55a865a2e7141d3cca4f39afa3dbd3329408bc461595337988b2b74b5c:PM.Tickets.Parlay:ParlayTicket',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        legs: damlTypes.List(exports.ParlayLeg).decoder,
        stake: damlTypes.Int.decoder,
        maxPayout: damlTypes.Int.decoder,
        voidAfter: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        legs: damlTypes.List(exports.ParlayLeg).encode(__typed__.legs),
        stake: damlTypes.Int.encode(__typed__.stake),
        maxPayout: damlTypes.Int.encode(__typed__.maxPayout),
        voidAfter: damlTypes.Time.encode(__typed__.voidAfter),
      };
    },
    Archive: {
      template: function () { return exports.ParlayTicket; },
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
    Ticket_ClaimLeg: {
      template: function () { return exports.ParlayTicket; },
      choiceName: 'Ticket_ClaimLeg',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Ticket_ClaimLeg.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Ticket_ClaimLeg.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return exports.ParlayStep.decoder;
      }),
      resultEncode: function (__typed__) { return exports.ParlayStep.encode(__typed__); },
    },
    Ticket_ResolveLeg: {
      template: function () { return exports.ParlayTicket; },
      choiceName: 'Ticket_ResolveLeg',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Ticket_ResolveLeg.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Ticket_ResolveLeg.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return exports.ParlayStep.decoder;
      }),
      resultEncode: function (__typed__) { return exports.ParlayStep.encode(__typed__); },
    },
    Ticket_VoidStale: {
      template: function () { return exports.ParlayTicket; },
      choiceName: 'Ticket_VoidStale',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Ticket_VoidStale.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Ticket_VoidStale.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return PM_Tickets_Common.Paid.decoder;
      }),
      resultEncode: function (__typed__) { return PM_Tickets_Common.Paid.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.ParlayTicket, ['ba653c55a865a2e7141d3cca4f39afa3dbd3329408bc461595337988b2b74b5c', '#abu-pm-tickets']);

exports.Ticket_ClaimLeg = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Ticket_ResolveLeg = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      resolutionCid: damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      resolutionCid: damlTypes.ContractId(pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Ticket_VoidStale = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
