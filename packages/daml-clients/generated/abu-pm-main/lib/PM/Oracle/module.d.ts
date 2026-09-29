// Generated from ../../PM/Oracle/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type Evidence = {
  oracle: damlTypes.Party,
  priceE8: damlTypes.Int,
  fetchedAt: damlTypes.Time,
  payloadHash: string,
  quoteCid: damlTypes.ContractId<PriceQuote>,
}

export declare const Evidence:
  damlTypes.Serializable<Evidence>

export declare type PriceQuote = {
  oracle: damlTypes.Party,
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  symbol: string,
  boundaryT: damlTypes.Time,
  priceE8: damlTypes.Int,
  barStart: damlTypes.Time,
  barLenSec: damlTypes.Int,
  fetchedAt: damlTypes.Time,
  payloadHash: string,
  policyVersion: damlTypes.Int,
}

export declare interface PriceQuoteInterface {
  Archive: 
    damlTypes.Choice<PriceQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PriceQuote, undefined>>;
  PriceQuote_Retire: 
    damlTypes.Choice<PriceQuote, PriceQuote_Retire, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PriceQuote, undefined>>;
}
export declare const PriceQuote:
  damlTypes.Template<PriceQuote, undefined, '#abu-pm-main:PM.Oracle:PriceQuote'> &
  damlTypes.ToInterface<PriceQuote, never> &
  PriceQuoteInterface

export declare type PriceQuote_Retire = {
}

export declare const PriceQuote_Retire:
  damlTypes.Serializable<PriceQuote_Retire>

export declare type PrintRule = {
  symbol: string,
  boundary: damlTypes.Time,
  oracles: damlTypes.Party[],
  barLenSec: damlTypes.Int,
  policyVersion: damlTypes.Int,
  earliest: damlTypes.Time,
  deadline: damlTypes.Time,
}

export declare const PrintRule:
  damlTypes.Serializable<PrintRule>
