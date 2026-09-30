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

var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0');

var PM_Leg = require('../../PM/Leg/module');
var PM_Market = require('../../PM/Market/module');
var PM_Money = require('../../PM/Money/module');
var PM_Quote = require('../../PM/Quote/module');
var PM_Reserve = require('../../PM/Reserve/module');

exports.MakerDesk = damlTypes.assembleTemplate(
  {
    templateId: '#abu-pm-main:PM.Maker:MakerDesk',
    templateIdWithPackageId: '#27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580:PM.Maker:MakerDesk',
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
      template: function () { return exports.MakerDesk; },
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
    Maker_PublishNav: {
      template: function () { return exports.MakerDesk; },
      choiceName: 'Maker_PublishNav',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Maker_PublishNav.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Maker_PublishNav.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(PM_Reserve.NavStatement).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(PM_Reserve.NavStatement).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.MakerDesk, ['27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580', '#abu-pm-main']);

exports.MakerNavInputs = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).decoder,
      lpShares: damlTypes.List(damlTypes.ContractId(PM_Reserve.LpShare)).decoder,
      withdrawQuotes: damlTypes.List(damlTypes.ContractId(PM_Reserve.WithdrawQuote)).decoder,
      quotes: damlTypes.List(damlTypes.ContractId(PM_Quote.Quote)).decoder,
      buyQuotes: damlTypes.List(damlTypes.ContractId(PM_Quote.BuyQuote)).decoder,
      legs: damlTypes.List(damlTypes.ContractId(PM_Leg.Leg)).decoder,
      residuals: damlTypes.List(damlTypes.ContractId(PM_Leg.NettedResidual)).decoder,
      resolutions: damlTypes.List(damlTypes.ContractId(PM_Market.Resolution)).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      cash: damlTypes.List(damlTypes.ContractId(PM_Money.VenueCash)).encode(__typed__.cash),
      lpShares: damlTypes.List(damlTypes.ContractId(PM_Reserve.LpShare)).encode(__typed__.lpShares),
      withdrawQuotes: damlTypes.List(damlTypes.ContractId(PM_Reserve.WithdrawQuote)).encode(__typed__.withdrawQuotes),
      quotes: damlTypes.List(damlTypes.ContractId(PM_Quote.Quote)).encode(__typed__.quotes),
      buyQuotes: damlTypes.List(damlTypes.ContractId(PM_Quote.BuyQuote)).encode(__typed__.buyQuotes),
      legs: damlTypes.List(damlTypes.ContractId(PM_Leg.Leg)).encode(__typed__.legs),
      residuals: damlTypes.List(damlTypes.ContractId(PM_Leg.NettedResidual)).encode(__typed__.residuals),
      resolutions: damlTypes.List(damlTypes.ContractId(PM_Market.Resolution)).encode(__typed__.resolutions),
    };
  },
};

exports.Maker_PublishNav = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      navCid: damlTypes.ContractId(PM_Reserve.NavStatement).decoder,
      asOf: damlTypes.Time.decoder,
      inputs: exports.MakerNavInputs.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      navCid: damlTypes.ContractId(PM_Reserve.NavStatement).encode(__typed__.navCid),
      asOf: damlTypes.Time.encode(__typed__.asOf),
      inputs: exports.MakerNavInputs.encode(__typed__.inputs),
    };
  },
};
