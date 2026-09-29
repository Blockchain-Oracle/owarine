// Generated from ../../PM/Market/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Oracle from '../../PM/Oracle/module';
import * as PM_Types from '../../PM/Types/module';

export declare type MarketTerms = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  seriesKey: string,
  marketId: string,
  index: damlTypes.Int,
  symbol: string,
  cashUnit: damlTypes.Int,
  tradingStart: damlTypes.Time,
  lockAt: damlTypes.Time,
  expiry: damlTypes.Time,
  openDeadline: damlTypes.Time,
  closeDeadline: damlTypes.Time,
  refundAfter: damlTypes.Time,
  policyVersion: damlTypes.Int,
  printSource: string,
  minDelaySec: damlTypes.Int,
  barLenSec: damlTypes.Int,
  tieUp: boolean,
  oracles: damlTypes.Party[],
  quorum: damlTypes.Int,
  maxDeviationBps: damlTypes.Int,
}

export declare interface MarketTermsInterface {
  Archive: 
    damlTypes.Choice<MarketTerms, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<MarketTerms, undefined>>;
  Terms_RecordOpen: 
    damlTypes.Choice<MarketTerms, Terms_RecordOpen, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Either<damlTypes.ContractId<Resolution>, damlTypes.ContractId<OpenPrint>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<MarketTerms, undefined>>;
  Terms_Resolve: 
    damlTypes.Choice<MarketTerms, Terms_Resolve, damlTypes.ContractId<Resolution>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<MarketTerms, undefined>>;
  Terms_Void: 
    damlTypes.Choice<MarketTerms, Terms_Void, damlTypes.ContractId<Resolution>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<MarketTerms, undefined>>;
}
export declare const MarketTerms:
  damlTypes.Template<MarketTerms, undefined, '#abu-pm-main:PM.Market:MarketTerms'> &
  damlTypes.ToInterface<MarketTerms, never> &
  MarketTermsInterface

export declare type OpenPrint = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  termsCid: damlTypes.ContractId<MarketTerms>,
  marketId: string,
  openPriceE8: damlTypes.Int,
  evidence: PM_Oracle.Evidence[],
  signers: damlTypes.Int,
}

export declare interface OpenPrintInterface {
  Archive: 
    damlTypes.Choice<OpenPrint, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<OpenPrint, undefined>>;
}
export declare const OpenPrint:
  damlTypes.Template<OpenPrint, undefined, '#abu-pm-main:PM.Market:OpenPrint'> &
  damlTypes.ToInterface<OpenPrint, never> &
  OpenPrintInterface

export declare type Resolution = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  termsCid: damlTypes.ContractId<MarketTerms>,
  marketId: string,
  outcome: damlTypes.Optional<PM_Types.Side>,
  voidReason: damlTypes.Optional<PM_Types.VoidReason>,
  openPriceE8: damlTypes.Optional<damlTypes.Int>,
  closePriceE8: damlTypes.Optional<damlTypes.Int>,
  openEvidence: PM_Oracle.Evidence[],
  closeEvidence: PM_Oracle.Evidence[],
  signers: damlTypes.Int,
}

export declare interface ResolutionInterface {
  Archive: 
    damlTypes.Choice<Resolution, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Resolution, undefined>>;
}
export declare const Resolution:
  damlTypes.Template<Resolution, undefined, '#abu-pm-main:PM.Market:Resolution'> &
  damlTypes.ToInterface<Resolution, never> &
  ResolutionInterface

export declare type Terms_RecordOpen = {
  stateCid: damlTypes.ContractId<WindowState>,
  quoteCids: damlTypes.ContractId<PM_Oracle.PriceQuote>[],
}

export declare const Terms_RecordOpen:
  damlTypes.Serializable<Terms_RecordOpen>

export declare type Terms_Resolve = {
  openCid: damlTypes.ContractId<OpenPrint>,
  quoteCids: damlTypes.ContractId<PM_Oracle.PriceQuote>[],
}

export declare const Terms_Resolve:
  damlTypes.Serializable<Terms_Resolve>

export declare type Terms_Void = {
  stage: VoidStage,
  quoteCids: damlTypes.ContractId<PM_Oracle.PriceQuote>[],
}

export declare const Terms_Void:
  damlTypes.Serializable<Terms_Void>

export declare type VoidStage =
  | { tag: 'BeforeOpen'; value: VoidStage.BeforeOpen }
  | { tag: 'AfterOpen'; value: VoidStage.AfterOpen }


export declare const VoidStage:
  damlTypes.Serializable<VoidStage> & {
    AfterOpen: damlTypes.Serializable<VoidStage.AfterOpen>;
    BeforeOpen: damlTypes.Serializable<VoidStage.BeforeOpen>;
  }

export namespace VoidStage {
  type AfterOpen = {
    openCid: damlTypes.ContractId<OpenPrint>,
  }
  type BeforeOpen = {
    stateCid: damlTypes.ContractId<WindowState>,
  }
}

export declare type WindowState = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  termsCid: damlTypes.ContractId<MarketTerms>,
}

export declare interface WindowStateInterface {
  Archive: 
    damlTypes.Choice<WindowState, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<WindowState, undefined>>;
}
export declare const WindowState:
  damlTypes.Template<WindowState, undefined, '#abu-pm-main:PM.Market:WindowState'> &
  damlTypes.ToInterface<WindowState, never> &
  WindowStateInterface
