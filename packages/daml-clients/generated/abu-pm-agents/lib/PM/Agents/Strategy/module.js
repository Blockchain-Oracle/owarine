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

var pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 = require('@daml.js/abu-pm-main-0.5.1');
var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@daml.js/daml-prim-DA-Types-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

exports.CreatorLicense = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:CreatorLicense',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:CreatorLicense',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        nextIndex: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        nextIndex: damlTypes.Int.encode(__typed__.nextIndex),
      };
    },
    Archive: {
      template: function () { return exports.CreatorLicense; },
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
    License_Payout: {
      template: function () { return exports.CreatorLicense; },
      choiceName: 'License_Payout',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.License_Payout.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.License_Payout.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.CreatorPayout).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.CreatorPayout).encode(__typed__); },
    },
    License_Publish: {
      template: function () { return exports.CreatorLicense; },
      choiceName: 'License_Publish',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.License_Publish.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.License_Publish.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.CreatorLicense), damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.CreatorLicense), damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CreatorLicense, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.CreatorPayout = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:CreatorPayout',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:CreatorPayout',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        period: damlTypes.Int.decoder,
        feeCount: damlTypes.Int.decoder,
        amount: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        period: damlTypes.Int.encode(__typed__.period),
        feeCount: damlTypes.Int.encode(__typed__.feeCount),
        amount: damlTypes.Int.encode(__typed__.amount),
      };
    },
    Archive: {
      template: function () { return exports.CreatorPayout; },
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
    Payout_Claim: {
      template: function () { return exports.CreatorPayout; },
      choiceName: 'Payout_Claim',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Payout_Claim.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Payout_Claim.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CreatorPayout, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.Envelope = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      maxStakePerTrade: damlTypes.Int.decoder,
      maxDailySpend: damlTypes.Int.decoder,
      maxOpenPositions: damlTypes.Int.decoder,
      maxPriceTicks: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      maxStakePerTrade: damlTypes.Int.encode(__typed__.maxStakePerTrade),
      maxDailySpend: damlTypes.Int.encode(__typed__.maxDailySpend),
      maxOpenPositions: damlTypes.Int.encode(__typed__.maxOpenPositions),
      maxPriceTicks: damlTypes.Int.encode(__typed__.maxPriceTicks),
    };
  },
};

exports.Invite_OpenBook = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.License_Payout = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      feeCids: damlTypes.List(damlTypes.ContractId(exports.StrategyFee)).decoder,
      period: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      feeCids: damlTypes.List(damlTypes.ContractId(exports.StrategyFee)).encode(__typed__.feeCids),
      period: damlTypes.Int.encode(__typed__.period),
    };
  },
};

exports.License_Publish = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      runner: damlTypes.Party.decoder,
      envelope: exports.Envelope.decoder,
      fee: damlTypes.Int.decoder,
      spec: damlTypes.Text.decoder,
      specHash: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      runner: damlTypes.Party.encode(__typed__.runner),
      envelope: exports.Envelope.encode(__typed__.envelope),
      fee: damlTypes.Int.encode(__typed__.fee),
      spec: damlTypes.Text.encode(__typed__.spec),
      specHash: damlTypes.Text.encode(__typed__.specHash),
    };
  },
};

exports.Listing_Sync = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      strategyCid: damlTypes.ContractId(exports.Strategy).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      strategyCid: damlTypes.ContractId(exports.Strategy).encode(__typed__.strategyCid),
    };
  },
};

exports.Payout_Claim = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Strategy = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:Strategy',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:Strategy',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        strategyId: damlTypes.Text.decoder,
        runner: damlTypes.Party.decoder,
        envelope: exports.Envelope.decoder,
        fee: damlTypes.Int.decoder,
        spec: damlTypes.Text.decoder,
        specHash: damlTypes.Text.decoder,
        version: damlTypes.Int.decoder,
        active: damlTypes.Bool.decoder,
        publishedAt: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Time).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        strategyId: damlTypes.Text.encode(__typed__.strategyId),
        runner: damlTypes.Party.encode(__typed__.runner),
        envelope: exports.Envelope.encode(__typed__.envelope),
        fee: damlTypes.Int.encode(__typed__.fee),
        spec: damlTypes.Text.encode(__typed__.spec),
        specHash: damlTypes.Text.encode(__typed__.specHash),
        version: damlTypes.Int.encode(__typed__.version),
        active: damlTypes.Bool.encode(__typed__.active),
        publishedAt: damlTypes.Optional(damlTypes.Time).encode(__typed__.publishedAt),
      };
    },
    Archive: {
      template: function () { return exports.Strategy; },
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
    Strategy_Deactivate: {
      template: function () { return exports.Strategy; },
      choiceName: 'Strategy_Deactivate',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Strategy_Deactivate.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Strategy_Deactivate.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).encode(__typed__); },
    },
    Strategy_SetRunner: {
      template: function () { return exports.Strategy; },
      choiceName: 'Strategy_SetRunner',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Strategy_SetRunner.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Strategy_SetRunner.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).encode(__typed__); },
    },
    Strategy_Update: {
      template: function () { return exports.Strategy; },
      choiceName: 'Strategy_Update',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Strategy_Update.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Strategy_Update.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.Strategy), damlTypes.ContractId(exports.StrategyListing)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.Strategy, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.StrategyFee = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:StrategyFee',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:StrategyFee',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        strategyId: damlTypes.Text.decoder,
        amount: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        strategyId: damlTypes.Text.encode(__typed__.strategyId),
        amount: damlTypes.Int.encode(__typed__.amount),
      };
    },
    Archive: {
      template: function () { return exports.StrategyFee; },
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

damlTypes.registerTemplate(exports.StrategyFee, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.StrategyListing = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:StrategyListing',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:StrategyListing',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        strategyId: damlTypes.Text.decoder,
        strategyCid: damlTypes.ContractId(exports.Strategy).decoder,
        runner: damlTypes.Party.decoder,
        envelope: exports.Envelope.decoder,
        fee: damlTypes.Int.decoder,
        specHash: damlTypes.Text.decoder,
        version: damlTypes.Int.decoder,
        active: damlTypes.Bool.decoder,
        publishedAt: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Time).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        creator: damlTypes.Party.encode(__typed__.creator),
        strategyId: damlTypes.Text.encode(__typed__.strategyId),
        strategyCid: damlTypes.ContractId(exports.Strategy).encode(__typed__.strategyCid),
        runner: damlTypes.Party.encode(__typed__.runner),
        envelope: exports.Envelope.encode(__typed__.envelope),
        fee: damlTypes.Int.encode(__typed__.fee),
        specHash: damlTypes.Text.encode(__typed__.specHash),
        version: damlTypes.Int.encode(__typed__.version),
        active: damlTypes.Bool.encode(__typed__.active),
        publishedAt: damlTypes.Optional(damlTypes.Time).encode(__typed__.publishedAt),
      };
    },
    Archive: {
      template: function () { return exports.StrategyListing; },
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
    Listing_Sync: {
      template: function () { return exports.StrategyListing; },
      choiceName: 'Listing_Sync',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Listing_Sync.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Listing_Sync.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.StrategyListing).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.StrategyListing).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.StrategyListing, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.Strategy_Deactivate = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      listingCid: damlTypes.ContractId(exports.StrategyListing).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      listingCid: damlTypes.ContractId(exports.StrategyListing).encode(__typed__.listingCid),
    };
  },
};

exports.Strategy_SetRunner = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newRunner: damlTypes.Party.decoder,
      listingCid: damlTypes.ContractId(exports.StrategyListing).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newRunner: damlTypes.Party.encode(__typed__.newRunner),
      listingCid: damlTypes.ContractId(exports.StrategyListing).encode(__typed__.listingCid),
    };
  },
};

exports.Strategy_Update = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newSpec: damlTypes.Text.decoder,
      newSpecHash: damlTypes.Text.decoder,
      newFee: damlTypes.Int.decoder,
      listingCid: damlTypes.ContractId(exports.StrategyListing).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newSpec: damlTypes.Text.encode(__typed__.newSpec),
      newSpecHash: damlTypes.Text.encode(__typed__.newSpecHash),
      newFee: damlTypes.Int.encode(__typed__.newFee),
      listingCid: damlTypes.ContractId(exports.StrategyListing).encode(__typed__.listingCid),
    };
  },
};

exports.SubKind = {
  SubCopy: 'SubCopy',
  SubFade: 'SubFade',
  SubMirror: 'SubMirror',
  keys: ['SubCopy', 'SubFade', 'SubMirror'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.SubKind.SubCopy),
      jtv.constant(exports.SubKind.SubFade),
      jtv.constant(exports.SubKind.SubMirror),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.SubscriberBook = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:SubscriberBook',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:SubscriberBook',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        subscriber: damlTypes.Party.decoder,
        following: damlTypes.List(damlTypes.Text).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        subscriber: damlTypes.Party.encode(__typed__.subscriber),
        following: damlTypes.List(damlTypes.Text).encode(__typed__.following),
      };
    },
    Archive: {
      template: function () { return exports.SubscriberBook; },
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
    Subscriber_Subscribe: {
      template: function () { return exports.SubscriberBook; },
      choiceName: 'Subscriber_Subscribe',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Subscriber_Subscribe.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Subscriber_Subscribe.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.SubscriberBook), damlTypes.ContractId(exports.Subscription), damlTypes.Optional(damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.SubscriberBook), damlTypes.ContractId(exports.Subscription), damlTypes.Optional(damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash))).encode(__typed__); },
    },
    Subscriber_Unsubscribe: {
      template: function () { return exports.SubscriberBook; },
      choiceName: 'Subscriber_Unsubscribe',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Subscriber_Unsubscribe.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Subscriber_Unsubscribe.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.SubscriberBook).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.SubscriberBook).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.SubscriberBook, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.SubscriberInvite = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:SubscriberInvite',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:SubscriberInvite',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        subscriber: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        subscriber: damlTypes.Party.encode(__typed__.subscriber),
      };
    },
    Archive: {
      template: function () { return exports.SubscriberInvite; },
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
    Invite_OpenBook: {
      template: function () { return exports.SubscriberInvite; },
      choiceName: 'Invite_OpenBook',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Invite_OpenBook.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Invite_OpenBook.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.SubscriberBook).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.SubscriberBook).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.SubscriberInvite, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);

exports.Subscriber_Subscribe = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      listingCid: damlTypes.ContractId(exports.StrategyListing).decoder,
      grantCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Grant.AgentGrant).decoder,
      kind: exports.SubKind.decoder,
      maxFee: damlTypes.Int.decoder,
      expectVersion: damlTypes.Int.decoder,
      cash: damlTypes.List(damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      listingCid: damlTypes.ContractId(exports.StrategyListing).encode(__typed__.listingCid),
      grantCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Grant.AgentGrant).encode(__typed__.grantCid),
      kind: exports.SubKind.encode(__typed__.kind),
      maxFee: damlTypes.Int.encode(__typed__.maxFee),
      expectVersion: damlTypes.Int.encode(__typed__.expectVersion),
      cash: damlTypes.List(damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.Subscriber_Unsubscribe = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      subscriptionCid: damlTypes.ContractId(exports.Subscription).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      subscriptionCid: damlTypes.ContractId(exports.Subscription).encode(__typed__.subscriptionCid),
    };
  },
};

exports.Subscription = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Strategy:Subscription',
    templateIdWithPackageId: '#b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589:PM.Agents.Strategy:Subscription',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        subscriber: damlTypes.Party.decoder,
        creator: damlTypes.Party.decoder,
        strategyId: damlTypes.Text.decoder,
        runner: damlTypes.Party.decoder,
        kind: exports.SubKind.decoder,
        version: damlTypes.Int.decoder,
        specHash: damlTypes.Text.decoder,
        grantCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Grant.AgentGrant).decoder,
        feePaid: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        subscriber: damlTypes.Party.encode(__typed__.subscriber),
        creator: damlTypes.Party.encode(__typed__.creator),
        strategyId: damlTypes.Text.encode(__typed__.strategyId),
        runner: damlTypes.Party.encode(__typed__.runner),
        kind: exports.SubKind.encode(__typed__.kind),
        version: damlTypes.Int.encode(__typed__.version),
        specHash: damlTypes.Text.encode(__typed__.specHash),
        grantCid: damlTypes.ContractId(pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Grant.AgentGrant).encode(__typed__.grantCid),
        feePaid: damlTypes.Int.encode(__typed__.feePaid),
      };
    },
    Archive: {
      template: function () { return exports.Subscription; },
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

damlTypes.registerTemplate(exports.Subscription, ['b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589', '#abu-pm-agents']);
