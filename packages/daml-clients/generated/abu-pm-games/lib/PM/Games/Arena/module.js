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
var pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a = require('@daml.js/abu-pm-main-0.5.2');

exports.ArenaParams = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      joinWindowSec: damlTypes.Int.decoder,
      revealWindowSec: damlTypes.Int.decoder,
      pickWindowSec: damlTypes.Int.decoder,
      minDeckSize: damlTypes.Int.decoder,
      maxDeckSize: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      joinWindowSec: damlTypes.Int.encode(__typed__.joinWindowSec),
      revealWindowSec: damlTypes.Int.encode(__typed__.revealWindowSec),
      pickWindowSec: damlTypes.Int.encode(__typed__.pickWindowSec),
      minDeckSize: damlTypes.Int.encode(__typed__.minDeckSize),
      maxDeckSize: damlTypes.Int.encode(__typed__.maxDeckSize),
    };
  },
};

exports.ArenaTerms = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-games:PM.Games.Arena:ArenaTerms',
    templateIdWithPackageId: '#1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6:PM.Games.Arena:ArenaTerms',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        arenaId: damlTypes.Text.decoder,
        policyVersion: damlTypes.Int.decoder,
        params: exports.ArenaParams.decoder,
        tiers: damlTypes.List(exports.Tier).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        arenaId: damlTypes.Text.encode(__typed__.arenaId),
        policyVersion: damlTypes.Int.encode(__typed__.policyVersion),
        params: exports.ArenaParams.encode(__typed__.params),
        tiers: damlTypes.List(exports.Tier).encode(__typed__.tiers),
      };
    },
    Archive: {
      template: function () { return exports.ArenaTerms; },
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
    Arena_OpenDuel: {
      template: function () { return exports.ArenaTerms; },
      choiceName: 'Arena_OpenDuel',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Arena_OpenDuel.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Arena_OpenDuel.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DuelOpen), damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DuelOpen), damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash))).encode(__typed__); },
    },
    Arena_Update: {
      template: function () { return exports.ArenaTerms; },
      choiceName: 'Arena_Update',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Arena_Update.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Arena_Update.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.ArenaTerms).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.ArenaTerms).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.ArenaTerms, ['1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6', '#abu-pm-games']);

exports.Arena_OpenDuel = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      creator: damlTypes.Party.decoder,
      challenger: damlTypes.Party.decoder,
      matchId: damlTypes.Text.decoder,
      tierId: damlTypes.Text.decoder,
      deckHash: damlTypes.Text.decoder,
      deckSize: damlTypes.Int.decoder,
      clientSeeds: damlTypes.List(damlTypes.Text).decoder,
      joinDeadline: damlTypes.Time.decoder,
      cash: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      creator: damlTypes.Party.encode(__typed__.creator),
      challenger: damlTypes.Party.encode(__typed__.challenger),
      matchId: damlTypes.Text.encode(__typed__.matchId),
      tierId: damlTypes.Text.encode(__typed__.tierId),
      deckHash: damlTypes.Text.encode(__typed__.deckHash),
      deckSize: damlTypes.Int.encode(__typed__.deckSize),
      clientSeeds: damlTypes.List(damlTypes.Text).encode(__typed__.clientSeeds),
      joinDeadline: damlTypes.Time.encode(__typed__.joinDeadline),
      cash: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.Arena_Update = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newParams: exports.ArenaParams.decoder,
      newTiers: damlTypes.List(exports.Tier).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newParams: exports.ArenaParams.encode(__typed__.newParams),
      newTiers: damlTypes.List(exports.Tier).encode(__typed__.newTiers),
    };
  },
};

exports.Card = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      termsCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms).decoder,
      marketId: damlTypes.Text.decoder,
      lockAt: damlTypes.Time.decoder,
      refundAfter: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      termsCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms).encode(__typed__.termsCid),
      marketId: damlTypes.Text.encode(__typed__.marketId),
      lockAt: damlTypes.Time.encode(__typed__.lockAt),
      refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
    };
  },
};

exports.DuelMatch = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-games:PM.Games.Arena:DuelMatch',
    templateIdWithPackageId: '#1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6:PM.Games.Arena:DuelMatch',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        challenger: damlTypes.Party.decoder,
        arenaId: damlTypes.Text.decoder,
        matchId: damlTypes.Text.decoder,
        policyVersion: damlTypes.Int.decoder,
        tier: exports.Tier.decoder,
        params: exports.ArenaParams.decoder,
        deckHash: damlTypes.Text.decoder,
        deckSize: damlTypes.Int.decoder,
        clientSeeds: damlTypes.List(damlTypes.Text).decoder,
        revealDeadline: damlTypes.Time.decoder,
        status: exports.DuelStatus.decoder,
        serverSeed: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
        cards: damlTypes.List(exports.Card).decoder,
        pickDeadline: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Time).decoder),
        picks: damlTypes.List(exports.Pick).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        challenger: damlTypes.Party.encode(__typed__.challenger),
        arenaId: damlTypes.Text.encode(__typed__.arenaId),
        matchId: damlTypes.Text.encode(__typed__.matchId),
        policyVersion: damlTypes.Int.encode(__typed__.policyVersion),
        tier: exports.Tier.encode(__typed__.tier),
        params: exports.ArenaParams.encode(__typed__.params),
        deckHash: damlTypes.Text.encode(__typed__.deckHash),
        deckSize: damlTypes.Int.encode(__typed__.deckSize),
        clientSeeds: damlTypes.List(damlTypes.Text).encode(__typed__.clientSeeds),
        revealDeadline: damlTypes.Time.encode(__typed__.revealDeadline),
        status: exports.DuelStatus.encode(__typed__.status),
        serverSeed: damlTypes.Optional(damlTypes.Text).encode(__typed__.serverSeed),
        cards: damlTypes.List(exports.Card).encode(__typed__.cards),
        pickDeadline: damlTypes.Optional(damlTypes.Time).encode(__typed__.pickDeadline),
        picks: damlTypes.List(exports.Pick).encode(__typed__.picks),
      };
    },
    Archive: {
      template: function () { return exports.DuelMatch; },
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
    Duel_Finalize: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_Finalize',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_Finalize.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_Finalize.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DuelResult).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DuelResult).encode(__typed__); },
    },
    Duel_Lock: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_Lock',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_Lock.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_Lock.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Either(damlTypes.ContractId(exports.DuelResult), damlTypes.ContractId(exports.DuelMatch)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Either(damlTypes.ContractId(exports.DuelResult), damlTypes.ContractId(exports.DuelMatch)).encode(__typed__); },
    },
    Duel_RecordPick: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_RecordPick',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_RecordPick.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_RecordPick.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DuelMatch).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DuelMatch).encode(__typed__); },
    },
    Duel_RefundStale: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_RefundStale',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_RefundStale.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_RefundStale.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DuelResult).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DuelResult).encode(__typed__); },
    },
    Duel_RefundUnrevealed: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_RefundUnrevealed',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_RefundUnrevealed.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_RefundUnrevealed.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DuelResult).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DuelResult).encode(__typed__); },
    },
    Duel_Reveal: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_Reveal',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_Reveal.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_Reveal.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DuelMatch).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DuelMatch).encode(__typed__); },
    },
    Duel_Score: {
      template: function () { return exports.DuelMatch; },
      choiceName: 'Duel_Score',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Duel_Score.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Duel_Score.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DuelMatch).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DuelMatch).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.DuelMatch, ['1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6', '#abu-pm-games']);

exports.DuelOpen = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-games:PM.Games.Arena:DuelOpen',
    templateIdWithPackageId: '#1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6:PM.Games.Arena:DuelOpen',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        challenger: damlTypes.Party.decoder,
        arenaId: damlTypes.Text.decoder,
        matchId: damlTypes.Text.decoder,
        policyVersion: damlTypes.Int.decoder,
        tier: exports.Tier.decoder,
        params: exports.ArenaParams.decoder,
        deckHash: damlTypes.Text.decoder,
        deckSize: damlTypes.Int.decoder,
        clientSeeds: damlTypes.List(damlTypes.Text).decoder,
        joinDeadline: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        challenger: damlTypes.Party.encode(__typed__.challenger),
        arenaId: damlTypes.Text.encode(__typed__.arenaId),
        matchId: damlTypes.Text.encode(__typed__.matchId),
        policyVersion: damlTypes.Int.encode(__typed__.policyVersion),
        tier: exports.Tier.encode(__typed__.tier),
        params: exports.ArenaParams.encode(__typed__.params),
        deckHash: damlTypes.Text.encode(__typed__.deckHash),
        deckSize: damlTypes.Int.encode(__typed__.deckSize),
        clientSeeds: damlTypes.List(damlTypes.Text).encode(__typed__.clientSeeds),
        joinDeadline: damlTypes.Time.encode(__typed__.joinDeadline),
      };
    },
    Archive: {
      template: function () { return exports.DuelOpen; },
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
    Open_Cancel: {
      template: function () { return exports.DuelOpen; },
      choiceName: 'Open_Cancel',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Open_Cancel.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Open_Cancel.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__); },
    },
    Open_Join: {
      template: function () { return exports.DuelOpen; },
      choiceName: 'Open_Join',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Open_Join.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Open_Join.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DuelMatch), damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DuelMatch), damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash))).encode(__typed__); },
    },
    Open_RefundUnjoined: {
      template: function () { return exports.DuelOpen; },
      choiceName: 'Open_RefundUnjoined',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Open_RefundUnjoined.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Open_RefundUnjoined.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.DuelOpen, ['1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6', '#abu-pm-games']);

exports.DuelOutcome = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("Won"),
        value: exports.DuelOutcome.Won.decoder,
      }),
      jtv.object({
        tag: jtv.constant("Tied"),
        value: damlTypes.Unit.decoder,
      }),
      jtv.object({
        tag: jtv.constant("Refunded"),
        value: exports.DuelOutcome.Refunded.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'Won': return {tag: __typed__.tag, value: exports.DuelOutcome.Won.encode(__typed__.value)};
      case 'Tied': return {tag: __typed__.tag, value: damlTypes.Unit.encode(__typed__.value)};
      case 'Refunded': return {tag: __typed__.tag, value: exports.DuelOutcome.Refunded.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type DuelOutcome';
    }
  },
  Refunded: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        reason: exports.RefundReason.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        reason: exports.RefundReason.encode(__typed__.reason),
      };
    },
  },
  Won: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        winner: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        winner: damlTypes.Party.encode(__typed__.winner),
      };
    },
  },
};

exports.DuelResult = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-games:PM.Games.Arena:DuelResult',
    templateIdWithPackageId: '#1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6:PM.Games.Arena:DuelResult',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        challenger: damlTypes.Party.decoder,
        arenaId: damlTypes.Text.decoder,
        matchId: damlTypes.Text.decoder,
        tierId: damlTypes.Text.decoder,
        ranked: damlTypes.Bool.decoder,
        outcome: exports.DuelOutcome.decoder,
        creatorPnl: damlTypes.Int.decoder,
        challengerPnl: damlTypes.Int.decoder,
        toCreator: damlTypes.Int.decoder,
        toChallenger: damlTypes.Int.decoder,
        serverSeed: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Text).decoder),
        cards: damlTypes.List(damlTypes.Text).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        challenger: damlTypes.Party.encode(__typed__.challenger),
        arenaId: damlTypes.Text.encode(__typed__.arenaId),
        matchId: damlTypes.Text.encode(__typed__.matchId),
        tierId: damlTypes.Text.encode(__typed__.tierId),
        ranked: damlTypes.Bool.encode(__typed__.ranked),
        outcome: exports.DuelOutcome.encode(__typed__.outcome),
        creatorPnl: damlTypes.Int.encode(__typed__.creatorPnl),
        challengerPnl: damlTypes.Int.encode(__typed__.challengerPnl),
        toCreator: damlTypes.Int.encode(__typed__.toCreator),
        toChallenger: damlTypes.Int.encode(__typed__.toChallenger),
        serverSeed: damlTypes.Optional(damlTypes.Text).encode(__typed__.serverSeed),
        cards: damlTypes.List(damlTypes.Text).encode(__typed__.cards),
      };
    },
    Archive: {
      template: function () { return exports.DuelResult; },
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

damlTypes.registerTemplate(exports.DuelResult, ['1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6', '#abu-pm-games']);

exports.DuelStatus = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("Unrevealed"),
        value: damlTypes.Unit.decoder,
      }),
      jtv.object({
        tag: jtv.constant("Picking"),
        value: damlTypes.Unit.decoder,
      }),
      jtv.object({
        tag: jtv.constant("Settling"),
        value: damlTypes.Unit.decoder,
      }),
      jtv.object({
        tag: jtv.constant("Forfeited"),
        value: exports.DuelStatus.Forfeited.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'Unrevealed': return {tag: __typed__.tag, value: damlTypes.Unit.encode(__typed__.value)};
      case 'Picking': return {tag: __typed__.tag, value: damlTypes.Unit.encode(__typed__.value)};
      case 'Settling': return {tag: __typed__.tag, value: damlTypes.Unit.encode(__typed__.value)};
      case 'Forfeited': return {tag: __typed__.tag, value: exports.DuelStatus.Forfeited.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type DuelStatus';
    }
  },
  Forfeited: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        absent: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        absent: damlTypes.Party.encode(__typed__.absent),
      };
    },
  },
};

exports.Duel_Finalize = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
    };
  },
};

exports.Duel_Lock = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
    };
  },
};

exports.Duel_RecordPick = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      player: damlTypes.Party.decoder,
      cardIndex: damlTypes.Int.decoder,
      legCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      player: damlTypes.Party.encode(__typed__.player),
      cardIndex: damlTypes.Int.encode(__typed__.cardIndex),
      legCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg).encode(__typed__.legCid),
    };
  },
};

exports.Duel_RefundStale = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
    };
  },
};

exports.Duel_RefundUnrevealed = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
    };
  },
};

exports.Duel_Reveal = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
      seed: damlTypes.Text.decoder,
      cardCids: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms)).decoder,
      newPickDeadline: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
      seed: damlTypes.Text.encode(__typed__.seed),
      cardCids: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.MarketTerms)).encode(__typed__.cardCids),
      newPickDeadline: damlTypes.Time.encode(__typed__.newPickDeadline),
    };
  },
};

exports.Duel_Score = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
      items: damlTypes.List(exports.ScoreItem).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
      items: damlTypes.List(exports.ScoreItem).encode(__typed__.items),
    };
  },
};

exports.Open_Cancel = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Open_Join = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).decoder,
      revealDeadline: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash)).encode(__typed__.cash),
      revealDeadline: damlTypes.Time.encode(__typed__.revealDeadline),
    };
  },
};

exports.Open_RefundUnjoined = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
    };
  },
};

exports.Pick = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      seat: damlTypes.Int.decoder,
      cardIndex: damlTypes.Int.decoder,
      legCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg).decoder,
      leg: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg.decoder,
      cost: damlTypes.Int.decoder,
      payout: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Int).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      seat: damlTypes.Int.encode(__typed__.seat),
      cardIndex: damlTypes.Int.encode(__typed__.cardIndex),
      legCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg).encode(__typed__.legCid),
      leg: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Leg.Leg.encode(__typed__.leg),
      cost: damlTypes.Int.encode(__typed__.cost),
      payout: damlTypes.Optional(damlTypes.Int).encode(__typed__.payout),
    };
  },
};

exports.RefundReason = {
  BothIncomplete: 'BothIncomplete',
  RevealUnavailable: 'RevealUnavailable',
  StaleSettlement: 'StaleSettlement',
  keys: ['BothIncomplete', 'RevealUnavailable', 'StaleSettlement'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.RefundReason.BothIncomplete),
      jtv.constant(exports.RefundReason.RevealUnavailable),
      jtv.constant(exports.RefundReason.StaleSettlement),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.ScoreItem = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      seat: damlTypes.Int.decoder,
      cardIndex: damlTypes.Int.decoder,
      resolutionCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.Resolution).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      seat: damlTypes.Int.encode(__typed__.seat),
      cardIndex: damlTypes.Int.encode(__typed__.cardIndex),
      resolutionCid: damlTypes.ContractId(pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Market.Resolution).encode(__typed__.resolutionCid),
    };
  },
};

exports.Tier = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      tierId: damlTypes.Text.decoder,
      potEach: damlTypes.Int.decoder,
      perCardCap: damlTypes.Int.decoder,
      ranked: damlTypes.Bool.decoder,
      enabled: damlTypes.Bool.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      tierId: damlTypes.Text.encode(__typed__.tierId),
      potEach: damlTypes.Int.encode(__typed__.potEach),
      perCardCap: damlTypes.Int.encode(__typed__.perCardCap),
      ranked: damlTypes.Bool.encode(__typed__.ranked),
      enabled: damlTypes.Bool.encode(__typed__.enabled),
    };
  },
};
