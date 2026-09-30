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

exports.DeskAction = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("DeskHold"),
        value: damlTypes.Unit.decoder,
      }),
      jtv.object({
        tag: jtv.constant("DeskTrade"),
        value: exports.DeskAction.DeskTrade.decoder,
      }),
      jtv.object({
        tag: jtv.constant("DeskSell"),
        value: exports.DeskAction.DeskSell.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'DeskHold': return {tag: __typed__.tag, value: damlTypes.Unit.encode(__typed__.value)};
      case 'DeskTrade': return {tag: __typed__.tag, value: exports.DeskAction.DeskTrade.encode(__typed__.value)};
      case 'DeskSell': return {tag: __typed__.tag, value: exports.DeskAction.DeskSell.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type DeskAction';
    }
  },
  DeskSell: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        marketId: damlTypes.Text.decoder,
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        priceTicks: damlTypes.Int.decoder,
        referenceTicks: damlTypes.Int.decoder,
        proceeds: damlTypes.Int.decoder,
        counted: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        marketId: damlTypes.Text.encode(__typed__.marketId),
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.encode(__typed__.side),
        lots: damlTypes.Int.encode(__typed__.lots),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        referenceTicks: damlTypes.Int.encode(__typed__.referenceTicks),
        proceeds: damlTypes.Int.encode(__typed__.proceeds),
        counted: damlTypes.Int.encode(__typed__.counted),
      };
    },
  },
  DeskTrade: {
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        marketId: damlTypes.Text.decoder,
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.decoder,
        lots: damlTypes.Int.decoder,
        priceTicks: damlTypes.Int.decoder,
        referenceTicks: damlTypes.Int.decoder,
        charge: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        marketId: damlTypes.Text.encode(__typed__.marketId),
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.encode(__typed__.side),
        lots: damlTypes.Int.encode(__typed__.lots),
        priceTicks: damlTypes.Int.encode(__typed__.priceTicks),
        referenceTicks: damlTypes.Int.encode(__typed__.referenceTicks),
        charge: damlTypes.Int.encode(__typed__.charge),
      };
    },
  },
};

exports.DeskDecision = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Desk:DeskDecision',
    templateIdWithPackageId: '#9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55:PM.Agents.Desk:DeskDecision',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        operator: damlTypes.Party.decoder,
        seq: damlTypes.Int.decoder,
        prevHead: damlTypes.Text.decoder,
        decisionHash: damlTypes.Text.decoder,
        head: damlTypes.Text.decoder,
        action: exports.DeskAction.decoder,
        note: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        operator: damlTypes.Party.encode(__typed__.operator),
        seq: damlTypes.Int.encode(__typed__.seq),
        prevHead: damlTypes.Text.encode(__typed__.prevHead),
        decisionHash: damlTypes.Text.encode(__typed__.decisionHash),
        head: damlTypes.Text.encode(__typed__.head),
        action: exports.DeskAction.encode(__typed__.action),
        note: damlTypes.Text.encode(__typed__.note),
      };
    },
    Archive: {
      template: function () { return exports.DeskDecision; },
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

damlTypes.registerTemplate(exports.DeskDecision, ['9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55', '#abu-pm-agents']);

exports.DeskHolding = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      marketId: damlTypes.Text.decoder,
      side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.decoder,
      lots: damlTypes.Int.decoder,
      refundAfter: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      marketId: damlTypes.Text.encode(__typed__.marketId),
      side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.encode(__typed__.side),
      lots: damlTypes.Int.encode(__typed__.lots),
      refundAfter: damlTypes.Time.encode(__typed__.refundAfter),
    };
  },
};

exports.DeskMandate = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Desk:DeskMandate',
    templateIdWithPackageId: '#9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55:PM.Agents.Desk:DeskMandate',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        operator: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Party).decoder),
        grant: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.AgentGrant.decoder,
        allowList: damlTypes.List(damlTypes.Text).decoder,
        maxPremiumBps: damlTypes.Int.decoder,
        attestors: damlTypes.List(damlTypes.Party).decoder,
        refQuorum: damlTypes.Int.decoder,
        mode: exports.DeskMode.decoder,
        paused: damlTypes.Bool.decoder,
        head: damlTypes.Text.decoder,
        seq: damlTypes.Int.decoder,
        holdings: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.List(exports.DeskHolding)).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        operator: damlTypes.Optional(damlTypes.Party).encode(__typed__.operator),
        grant: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.AgentGrant.encode(__typed__.grant),
        allowList: damlTypes.List(damlTypes.Text).encode(__typed__.allowList),
        maxPremiumBps: damlTypes.Int.encode(__typed__.maxPremiumBps),
        attestors: damlTypes.List(damlTypes.Party).encode(__typed__.attestors),
        refQuorum: damlTypes.Int.encode(__typed__.refQuorum),
        mode: exports.DeskMode.encode(__typed__.mode),
        paused: damlTypes.Bool.encode(__typed__.paused),
        head: damlTypes.Text.encode(__typed__.head),
        seq: damlTypes.Int.encode(__typed__.seq),
        holdings: damlTypes.Optional(damlTypes.List(exports.DeskHolding)).encode(__typed__.holdings),
      };
    },
    Archive: {
      template: function () { return exports.DeskMandate; },
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
    Mandate_Checkpoint: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Checkpoint',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Checkpoint.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Checkpoint.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(exports.DeskDecision)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(exports.DeskDecision)).encode(__typed__); },
    },
    Mandate_Close: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Close',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Close.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Close.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder);
      }),
      resultEncode: function (__typed__) { return damlTypes.Optional(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__); },
    },
    Mandate_Deposit: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Deposit',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Deposit.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Deposit.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_Pause: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Pause',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Pause.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Pause.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_RevokeOperator: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_RevokeOperator',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_RevokeOperator.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_RevokeOperator.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_Sell: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Sell',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Sell.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Sell.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(exports.DeskDecision)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(exports.DeskDecision)).encode(__typed__); },
    },
    Mandate_SetAllowList: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_SetAllowList',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_SetAllowList.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_SetAllowList.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_SetLimits: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_SetLimits',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_SetLimits.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_SetLimits.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_SetMode: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_SetMode',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_SetMode.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_SetMode.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_SetOperator: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_SetOperator',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_SetOperator.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_SetOperator.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_Trade: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Trade',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Trade.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Trade.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg), damlTypes.ContractId(exports.DeskDecision)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Leg.Leg), damlTypes.ContractId(exports.DeskDecision)).encode(__typed__); },
    },
    Mandate_Unpause: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Unpause',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Unpause.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Unpause.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
    Mandate_Withdraw: {
      template: function () { return exports.DeskMandate; },
      choiceName: 'Mandate_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Mandate_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Mandate_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.DeskMandate), damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.DeskMandate, ['9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55', '#abu-pm-agents']);

exports.DeskMark = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Desk:DeskMark',
    templateIdWithPackageId: '#9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55:PM.Agents.Desk:DeskMark',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        attestor: damlTypes.Party.decoder,
        venue: damlTypes.Party.decoder,
        marketId: damlTypes.Text.decoder,
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.decoder,
        refTicks: damlTypes.Int.decoder,
        fetchedAt: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        attestor: damlTypes.Party.encode(__typed__.attestor),
        venue: damlTypes.Party.encode(__typed__.venue),
        marketId: damlTypes.Text.encode(__typed__.marketId),
        side: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Types.Side.encode(__typed__.side),
        refTicks: damlTypes.Int.encode(__typed__.refTicks),
        fetchedAt: damlTypes.Time.encode(__typed__.fetchedAt),
      };
    },
    Archive: {
      template: function () { return exports.DeskMark; },
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

damlTypes.registerTemplate(exports.DeskMark, ['9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55', '#abu-pm-agents']);

exports.DeskMode = {
  DeskLive: 'DeskLive',
  DeskShadow: 'DeskShadow',
  keys: ['DeskLive', 'DeskShadow'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.DeskMode.DeskLive),
      jtv.constant(exports.DeskMode.DeskShadow),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.DeskOffer = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-agents:PM.Agents.Desk:DeskOffer',
    templateIdWithPackageId: '#9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55:PM.Agents.Desk:DeskOffer',
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
      template: function () { return exports.DeskOffer; },
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
    DeskOffer_Open: {
      template: function () { return exports.DeskOffer; },
      choiceName: 'DeskOffer_Open',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.DeskOffer_Open.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.DeskOffer_Open.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.DeskMandate).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.DeskMandate).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.DeskOffer, ['9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55', '#abu-pm-agents']);

exports.DeskOffer_Open = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      operator: damlTypes.Party.decoder,
      caps: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.GrantCaps.decoder,
      expiresAt: damlTypes.Time.decoder,
      dayZero: damlTypes.Time.decoder,
      budget: damlTypes.Int.decoder,
      cash: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).decoder,
      allowList: damlTypes.List(damlTypes.Text).decoder,
      maxPremiumBps: damlTypes.Int.decoder,
      attestors: damlTypes.List(damlTypes.Party).decoder,
      refQuorum: damlTypes.Int.decoder,
      mode: exports.DeskMode.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      operator: damlTypes.Party.encode(__typed__.operator),
      caps: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.GrantCaps.encode(__typed__.caps),
      expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      dayZero: damlTypes.Time.encode(__typed__.dayZero),
      budget: damlTypes.Int.encode(__typed__.budget),
      cash: damlTypes.List(damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash)).encode(__typed__.cash),
      allowList: damlTypes.List(damlTypes.Text).encode(__typed__.allowList),
      maxPremiumBps: damlTypes.Int.encode(__typed__.maxPremiumBps),
      attestors: damlTypes.List(damlTypes.Party).encode(__typed__.attestors),
      refQuorum: damlTypes.Int.encode(__typed__.refQuorum),
      mode: exports.DeskMode.encode(__typed__.mode),
    };
  },
};

exports.Mandate_Checkpoint = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
      prevHead: damlTypes.Text.decoder,
      decisionHash: damlTypes.Text.decoder,
      deadline: damlTypes.Time.decoder,
      note: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
      prevHead: damlTypes.Text.encode(__typed__.prevHead),
      decisionHash: damlTypes.Text.encode(__typed__.decisionHash),
      deadline: damlTypes.Time.encode(__typed__.deadline),
      note: damlTypes.Text.encode(__typed__.note),
    };
  },
};

exports.Mandate_Close = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Mandate_Deposit = {
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

exports.Mandate_Pause = {
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

exports.Mandate_RevokeOperator = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Mandate_Sell = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
      buyQuoteCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Quote.BuyQuote).decoder,
      asOf: damlTypes.Time.decoder,
      markCids: damlTypes.List(damlTypes.ContractId(exports.DeskMark)).decoder,
      prevHead: damlTypes.Text.decoder,
      decisionHash: damlTypes.Text.decoder,
      note: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
      buyQuoteCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Quote.BuyQuote).encode(__typed__.buyQuoteCid),
      asOf: damlTypes.Time.encode(__typed__.asOf),
      markCids: damlTypes.List(damlTypes.ContractId(exports.DeskMark)).encode(__typed__.markCids),
      prevHead: damlTypes.Text.encode(__typed__.prevHead),
      decisionHash: damlTypes.Text.encode(__typed__.decisionHash),
      note: damlTypes.Text.encode(__typed__.note),
    };
  },
};

exports.Mandate_SetAllowList = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newAllowList: damlTypes.List(damlTypes.Text).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newAllowList: damlTypes.List(damlTypes.Text).encode(__typed__.newAllowList),
    };
  },
};

exports.Mandate_SetLimits = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newCaps: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.GrantCaps.decoder,
      newMaxPremiumBps: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newCaps: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.GrantCaps.encode(__typed__.newCaps),
      newMaxPremiumBps: damlTypes.Int.encode(__typed__.newMaxPremiumBps),
    };
  },
};

exports.Mandate_SetMode = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newMode: exports.DeskMode.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newMode: exports.DeskMode.encode(__typed__.newMode),
    };
  },
};

exports.Mandate_SetOperator = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newOperator: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newOperator: damlTypes.Party.encode(__typed__.newOperator),
    };
  },
};

exports.Mandate_Trade = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      actor: damlTypes.Party.decoder,
      quoteCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Quote.Quote).decoder,
      limitTicks: damlTypes.Int.decoder,
      asOf: damlTypes.Time.decoder,
      markCids: damlTypes.List(damlTypes.ContractId(exports.DeskMark)).decoder,
      prevHead: damlTypes.Text.decoder,
      decisionHash: damlTypes.Text.decoder,
      note: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      actor: damlTypes.Party.encode(__typed__.actor),
      quoteCid: damlTypes.ContractId(pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Quote.Quote).encode(__typed__.quoteCid),
      limitTicks: damlTypes.Int.encode(__typed__.limitTicks),
      asOf: damlTypes.Time.encode(__typed__.asOf),
      markCids: damlTypes.List(damlTypes.ContractId(exports.DeskMark)).encode(__typed__.markCids),
      prevHead: damlTypes.Text.encode(__typed__.prevHead),
      decisionHash: damlTypes.Text.encode(__typed__.decisionHash),
      note: damlTypes.Text.encode(__typed__.note),
    };
  },
};

exports.Mandate_Unpause = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Mandate_Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      amount: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      amount: damlTypes.Int.encode(__typed__.amount),
    };
  },
};
