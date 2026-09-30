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

exports.Invite_Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Invite_Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.VenueAccount = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Money:VenueAccount',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Money:VenueAccount',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        label: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        label: damlTypes.Text.encode(__typed__.label),
      };
    },
    Archive: {
      template: function () { return exports.VenueAccount; },
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
    VenueAccount_Close: {
      template: function () { return exports.VenueAccount; },
      choiceName: 'VenueAccount_Close',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.VenueAccount_Close.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.VenueAccount_Close.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    VenueAccount_Credit: {
      template: function () { return exports.VenueAccount; },
      choiceName: 'VenueAccount_Credit',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.VenueAccount_Credit.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.VenueAccount_Credit.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.VenueCash).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.VenueAccount, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);

exports.VenueAccountInvite = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Money:VenueAccountInvite',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Money:VenueAccountInvite',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        label: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        label: damlTypes.Text.encode(__typed__.label),
      };
    },
    Archive: {
      template: function () { return exports.VenueAccountInvite; },
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
    Invite_Accept: {
      template: function () { return exports.VenueAccountInvite; },
      choiceName: 'Invite_Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Invite_Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Invite_Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.VenueAccount).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.VenueAccount).encode(__typed__); },
    },
    Invite_Withdraw: {
      template: function () { return exports.VenueAccountInvite; },
      choiceName: 'Invite_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Invite_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Invite_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.VenueAccountInvite, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);

exports.VenueAccount_Close = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.VenueAccount_Credit = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      amount: damlTypes.Int.decoder,
      bucket: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      amount: damlTypes.Int.encode(__typed__.amount),
      bucket: damlTypes.Text.encode(__typed__.bucket),
    };
  },
};

exports.VenueCash = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Money:VenueCash',
    templateIdWithPackageId: '#ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c:PM.Money:VenueCash',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        venue: damlTypes.Party.decoder,
        owner: damlTypes.Party.decoder,
        amount: damlTypes.Int.decoder,
        bucket: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        venue: damlTypes.Party.encode(__typed__.venue),
        owner: damlTypes.Party.encode(__typed__.owner),
        amount: damlTypes.Int.encode(__typed__.amount),
        bucket: damlTypes.Text.encode(__typed__.bucket),
      };
    },
    Archive: {
      template: function () { return exports.VenueCash; },
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
    VenueCash_Merge: {
      template: function () { return exports.VenueCash; },
      choiceName: 'VenueCash_Merge',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.VenueCash_Merge.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.VenueCash_Merge.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.VenueCash).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.VenueCash).encode(__typed__); },
    },
    VenueCash_Split: {
      template: function () { return exports.VenueCash; },
      choiceName: 'VenueCash_Split',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.VenueCash_Split.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.VenueCash_Split.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.VenueCash), damlTypes.Optional(damlTypes.ContractId(exports.VenueCash))).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.VenueCash), damlTypes.Optional(damlTypes.ContractId(exports.VenueCash))).encode(__typed__); },
    },
    VenueCash_Withdraw: {
      template: function () { return exports.VenueCash; },
      choiceName: 'VenueCash_Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.VenueCash_Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.VenueCash_Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.VenueCash, ['ad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c', '#abu-pm-main']);

exports.VenueCash_Merge = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      others: damlTypes.List(damlTypes.ContractId(exports.VenueCash)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      others: damlTypes.List(damlTypes.ContractId(exports.VenueCash)).encode(__typed__.others),
    };
  },
};

exports.VenueCash_Split = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      take: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      take: damlTypes.Int.encode(__typed__.take),
    };
  },
};

exports.VenueCash_Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
