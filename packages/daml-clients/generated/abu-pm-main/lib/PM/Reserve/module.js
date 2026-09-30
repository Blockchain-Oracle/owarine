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

var PM_Money = require('../../PM/Money/module');

exports.LpShare = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Reserve:LpShare',
    templateIdWithPackageId: '#076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c:PM.Reserve:LpShare',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        provider: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        shares: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        provider: damlTypes.Party.encode(__typed__.provider),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        shares: damlTypes.Int.encode(__typed__.shares),
      };
    },
    Archive: {
      template: function () { return exports.LpShare; },
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
    LpShare_Merge: {
      template: function () { return exports.LpShare; },
      choiceName: 'LpShare_Merge',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.LpShare_Merge.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.LpShare_Merge.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.LpShare).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.LpShare).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.LpShare, ['076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c', '#abu-pm-main']);

exports.LpShare_Merge = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      otherCid: damlTypes.ContractId(exports.LpShare).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      otherCid: damlTypes.ContractId(exports.LpShare).encode(__typed__.otherCid),
    };
  },
};

exports.NavStatement = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Reserve:NavStatement',
    templateIdWithPackageId: '#076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c:PM.Reserve:NavStatement',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        seq: damlTypes.Int.decoder,
        asOf: damlTypes.Time.decoder,
        assets: damlTypes.Int.decoder,
        shares: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        seq: damlTypes.Int.encode(__typed__.seq),
        asOf: damlTypes.Time.encode(__typed__.asOf),
        assets: damlTypes.Int.encode(__typed__.assets),
        shares: damlTypes.Int.encode(__typed__.shares),
      };
    },
    Archive: {
      template: function () { return exports.NavStatement; },
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
    Nav_IssueSupply: {
      template: function () { return exports.NavStatement; },
      choiceName: 'Nav_IssueSupply',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Nav_IssueSupply.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Nav_IssueSupply.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.SupplyQuote).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.SupplyQuote).encode(__typed__); },
    },
    Nav_IssueWithdraw: {
      template: function () { return exports.NavStatement; },
      choiceName: 'Nav_IssueWithdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Nav_IssueWithdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Nav_IssueWithdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.WithdrawQuote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.WithdrawQuote), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Nav_Publish: {
      template: function () { return exports.NavStatement; },
      choiceName: 'Nav_Publish',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Nav_Publish.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Nav_Publish.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.NavStatement).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.NavStatement).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.NavStatement, ['076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c', '#abu-pm-main']);

exports.Nav_IssueSupply = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      provider: damlTypes.Party.decoder,
      cashIn: damlTypes.Int.decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      provider: damlTypes.Party.encode(__typed__.provider),
      cashIn: damlTypes.Int.encode(__typed__.cashIn),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Nav_IssueWithdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      provider: damlTypes.Party.decoder,
      lpShareCid: damlTypes.ContractId(exports.LpShare).decoder,
      sharesIn: damlTypes.Int.decoder,
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).decoder,
      validUntil: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      provider: damlTypes.Party.encode(__typed__.provider),
      lpShareCid: damlTypes.ContractId(exports.LpShare).encode(__typed__.lpShareCid),
      sharesIn: damlTypes.Int.encode(__typed__.sharesIn),
      shardCid: damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__.shardCid),
      validUntil: damlTypes.Time.encode(__typed__.validUntil),
    };
  },
};

exports.Nav_Publish = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newAsOf: damlTypes.Time.decoder,
      newAssets: damlTypes.Int.decoder,
      newShares: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newAsOf: damlTypes.Time.encode(__typed__.newAsOf),
      newAssets: damlTypes.Int.encode(__typed__.newAssets),
      newShares: damlTypes.Int.encode(__typed__.newShares),
    };
  },
};

exports.SupplyQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Reserve:SupplyQuote',
    templateIdWithPackageId: '#076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c:PM.Reserve:SupplyQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        provider: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        navSeq: damlTypes.Int.decoder,
        cashIn: damlTypes.Int.decoder,
        sharesOut: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        provider: damlTypes.Party.encode(__typed__.provider),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        navSeq: damlTypes.Int.encode(__typed__.navSeq),
        cashIn: damlTypes.Int.encode(__typed__.cashIn),
        sharesOut: damlTypes.Int.encode(__typed__.sharesOut),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
      };
    },
    Archive: {
      template: function () { return exports.SupplyQuote; },
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
    Supply_Accept: {
      template: function () { return exports.SupplyQuote; },
      choiceName: 'Supply_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Supply_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Supply_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.LpShare), damlTypes.ContractId(PM_Money.VenueCash), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3(damlTypes.ContractId(exports.LpShare), damlTypes.ContractId(PM_Money.VenueCash), damlTypes.Optional(damlTypes.ContractId(PM_Money.VenueCash))).encode(__typed__); },
    },
    Supply_Expire: {
      template: function () { return exports.SupplyQuote; },
      choiceName: 'Supply_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Supply_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Supply_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Supply_Withdraw: {
      template: function () { return exports.SupplyQuote; },
      choiceName: 'Supply_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Supply_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Supply_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.SupplyQuote, ['076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c', '#abu-pm-main']);

exports.Supply_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.cash),
    };
  },
};

exports.Supply_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Supply_Withdraw = {
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

exports.WithdrawQuote = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Reserve:WithdrawQuote',
    templateIdWithPackageId: '#076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c:PM.Reserve:WithdrawQuote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        provider: damlTypes.Party.decoder,
        reserveId: damlTypes.Text.decoder,
        navSeq: damlTypes.Int.decoder,
        lpShareCid: damlTypes.ContractId(exports.LpShare).decoder,
        sharesIn: damlTypes.Int.decoder,
        cashOut: damlTypes.Int.decoder,
        validUntil: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        provider: damlTypes.Party.encode(__typed__.provider),
        reserveId: damlTypes.Text.encode(__typed__.reserveId),
        navSeq: damlTypes.Int.encode(__typed__.navSeq),
        lpShareCid: damlTypes.ContractId(exports.LpShare).encode(__typed__.lpShareCid),
        sharesIn: damlTypes.Int.encode(__typed__.sharesIn),
        cashOut: damlTypes.Int.encode(__typed__.cashOut),
        validUntil: damlTypes.Time.encode(__typed__.validUntil),
      };
    },
    Archive: {
      template: function () { return exports.WithdrawQuote; },
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
    Withdraw_Accept: {
      template: function () { return exports.WithdrawQuote; },
      choiceName: 'Withdraw_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdraw_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdraw_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_Money.VenueCash), damlTypes.Optional(damlTypes.ContractId(exports.LpShare))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(PM_Money.VenueCash), damlTypes.Optional(damlTypes.ContractId(exports.LpShare))).encode(__typed__); },
    },
    Withdraw_Expire: {
      template: function () { return exports.WithdrawQuote; },
      choiceName: 'Withdraw_Expire',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdraw_Expire.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdraw_Expire.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
    Withdraw_Withdraw: {
      template: function () { return exports.WithdrawQuote; },
      choiceName: 'Withdraw_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdraw_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdraw_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Money.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Money.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.WithdrawQuote, ['076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c', '#abu-pm-main']);

exports.Withdraw_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Withdraw_Expire = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Withdraw_Withdraw = {
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
