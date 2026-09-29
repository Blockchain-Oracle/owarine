// Generated from ../../PM/Series/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Event from '../../PM/Event/module';
import * as PM_Market from '../../PM/Market/module';
import * as PM_Types from '../../PM/Types/module';

export declare type Series = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  auditor: damlTypes.Party,
  seriesKey: string,
  symbol: string,
  anchor: damlTypes.Time,
  cadenceSec: damlTypes.Int,
  lockLeadSec: damlTypes.Int,
  settleGraceSec: damlTypes.Int,
  cashUnit: damlTypes.Int,
  nextIndex: damlTypes.Int,
  oracles: damlTypes.Party[],
  quorum: damlTypes.Int,
  maxDeviationBps: damlTypes.Int,
  policyVersions: PM_Types.PolicyVersion[],
  lastExpiry: damlTypes.Optional<damlTypes.Time>,
}

export declare interface SeriesInterface {
  Archive: 
    damlTypes.Choice<Series, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Series, undefined>>;
  Series_AddPolicyVersion: 
    damlTypes.Choice<Series, Series_AddPolicyVersion, damlTypes.ContractId<Series>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Series, undefined>>;
  Series_OpenEvent: 
    damlTypes.Choice<Series, Series_OpenEvent, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple4<damlTypes.ContractId<Series>, damlTypes.ContractId<PM_Market.MarketTerms>, damlTypes.ContractId<PM_Event.EventTerms>, damlTypes.ContractId<PM_Event.EventState>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Series, undefined>>;
  Series_OpenWindow: 
    damlTypes.Choice<Series, Series_OpenWindow, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<Series>, damlTypes.ContractId<PM_Market.MarketTerms>, damlTypes.ContractId<PM_Market.WindowState>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Series, undefined>>;
  Series_OpenWindowSpan: 
    damlTypes.Choice<Series, Series_OpenWindowSpan, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<Series>, damlTypes.ContractId<PM_Market.MarketTerms>, damlTypes.ContractId<PM_Market.WindowState>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Series, undefined>>;
  Series_SkipTo: 
    damlTypes.Choice<Series, Series_SkipTo, damlTypes.ContractId<Series>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Series, undefined>>;
}
export declare const Series:
  damlTypes.Template<Series, undefined, '#abu-pm-main:PM.Series:Series'> &
  damlTypes.ToInterface<Series, never> &
  SeriesInterface

export declare type Series_AddPolicyVersion = {
  pv: PM_Types.PolicyVersion,
}

export declare const Series_AddPolicyVersion:
  damlTypes.Serializable<Series_AddPolicyVersion>

export declare type Series_OpenEvent = {
  index: damlTypes.Int,
  question: string,
  tradingStart: damlTypes.Time,
  lockAt: damlTypes.Time,
  closeTime: damlTypes.Time,
}

export declare const Series_OpenEvent:
  damlTypes.Serializable<Series_OpenEvent>

export declare type Series_OpenWindow = {
  index: damlTypes.Int,
}

export declare const Series_OpenWindow:
  damlTypes.Serializable<Series_OpenWindow>

export declare type Series_OpenWindowSpan = {
  index: damlTypes.Int,
  tradingStart: damlTypes.Time,
  lockAt: damlTypes.Time,
  expiry: damlTypes.Time,
}

export declare const Series_OpenWindowSpan:
  damlTypes.Serializable<Series_OpenWindowSpan>

export declare type Series_SkipTo = {
  toIndex: damlTypes.Int,
}

export declare const Series_SkipTo:
  damlTypes.Serializable<Series_SkipTo>
