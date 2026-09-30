// Generated from ../../PM/Maker/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Leg from '../../PM/Leg/module';
import * as PM_Market from '../../PM/Market/module';
import * as PM_Money from '../../PM/Money/module';
import * as PM_Quote from '../../PM/Quote/module';
import * as PM_Reserve from '../../PM/Reserve/module';

export declare type MakerDesk = {
  venue: damlTypes.Party,
}

export declare interface MakerDeskInterface {
  Archive: 
    damlTypes.Choice<MakerDesk, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<MakerDesk, undefined>>;
  Maker_PublishNav: 
    damlTypes.Choice<MakerDesk, Maker_PublishNav, damlTypes.ContractId<PM_Reserve.NavStatement>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<MakerDesk, undefined>>;
}
export declare const MakerDesk:
  damlTypes.Template<MakerDesk, undefined, '#abu-pm-main:PM.Maker:MakerDesk'> &
  damlTypes.ToInterface<MakerDesk, never> &
  MakerDeskInterface

export declare type MakerNavInputs = {
  cash: damlTypes.ContractId<PM_Money.VenueCash>[],
  lpShares: damlTypes.ContractId<PM_Reserve.LpShare>[],
  withdrawQuotes: damlTypes.ContractId<PM_Reserve.WithdrawQuote>[],
  quotes: damlTypes.ContractId<PM_Quote.Quote>[],
  buyQuotes: damlTypes.ContractId<PM_Quote.BuyQuote>[],
  legs: damlTypes.ContractId<PM_Leg.Leg>[],
  residuals: damlTypes.ContractId<PM_Leg.NettedResidual>[],
  resolutions: damlTypes.ContractId<PM_Market.Resolution>[],
}

export declare const MakerNavInputs:
  damlTypes.Serializable<MakerNavInputs>

export declare type Maker_PublishNav = {
  navCid: damlTypes.ContractId<PM_Reserve.NavStatement>,
  asOf: damlTypes.Time,
  inputs: MakerNavInputs,
}

export declare const Maker_PublishNav:
  damlTypes.Serializable<Maker_PublishNav>
