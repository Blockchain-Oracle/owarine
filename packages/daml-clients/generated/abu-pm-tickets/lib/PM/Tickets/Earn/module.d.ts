// Generated from ../../../PM/Tickets/Earn/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c from '@daml.js/abu-pm-main-0.5.0';

import * as PM_Tickets_Boost from '../../../PM/Tickets/Boost/module';
import * as PM_Tickets_Parlay from '../../../PM/Tickets/Parlay/module';
import * as PM_Tickets_Range from '../../../PM/Tickets/Range/module';

export declare type EarnDesk = {
  venue: damlTypes.Party,
}

export declare interface EarnDeskInterface {
  Archive: 
    damlTypes.Choice<EarnDesk, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EarnDesk, undefined>>;
  Earn_IssueWithdraw: 
    damlTypes.Choice<EarnDesk, Earn_IssueWithdraw, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.WithdrawQuote>, damlTypes.Optional<damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EarnDesk, undefined>>;
  Earn_PublishNav: 
    damlTypes.Choice<EarnDesk, Earn_PublishNav, damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.NavStatement>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EarnDesk, undefined>>;
}
export declare const EarnDesk:
  damlTypes.Template<EarnDesk, undefined, '#abu-pm-tickets:PM.Tickets.Earn:EarnDesk'> &
  damlTypes.ToInterface<EarnDesk, never> &
  EarnDeskInterface

export declare type Earn_IssueWithdraw = {
  navCid: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.NavStatement>,
  provider: damlTypes.Party,
  lpShareCid: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.LpShare>,
  sharesIn: damlTypes.Int,
  shardCid: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>,
  validUntil: damlTypes.Time,
}

export declare const Earn_IssueWithdraw:
  damlTypes.Serializable<Earn_IssueWithdraw>

export declare type Earn_PublishNav = {
  navCid: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.NavStatement>,
  asOf: damlTypes.Time,
  inputs: NavInputs,
}

export declare const Earn_PublishNav:
  damlTypes.Serializable<Earn_PublishNav>

export declare type NavInputs = {
  cash: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>[],
  lpShares: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.LpShare>[],
  withdrawQuotes: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Reserve.WithdrawQuote>[],
  rangeQuotes: damlTypes.ContractId<PM_Tickets_Range.RangeQuote>[],
  rounds: damlTypes.ContractId<PM_Tickets_Range.RangeRound>[],
  parlayQuotes: damlTypes.ContractId<PM_Tickets_Parlay.ParlayQuote>[],
  tickets: damlTypes.ContractId<PM_Tickets_Parlay.ParlayTicket>[],
  boostQuotes: damlTypes.ContractId<PM_Tickets_Boost.BoostQuote>[],
  positions: damlTypes.ContractId<PM_Tickets_Boost.BoostPosition>[],
}

export declare const NavInputs:
  damlTypes.Serializable<NavInputs>
