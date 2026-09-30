// Generated from ../../../PM/Games/Season/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c from '@daml.js/abu-pm-main-0.5.0';
import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type Payout = {
  account: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueAccount>,
  amount: damlTypes.Int,
}

export declare const Payout:
  damlTypes.Serializable<Payout>

export declare type SeasonPool = {
  venue: damlTypes.Party,
  seasonId: string,
  endsAt: damlTypes.Time,
  amount: damlTypes.Int,
  deposited: damlTypes.Int,
  distributed: boolean,
}

export declare interface SeasonPoolInterface {
  Archive: 
    damlTypes.Choice<SeasonPool, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SeasonPool, undefined>>;
  Season_Distribute: 
    damlTypes.Choice<SeasonPool, Season_Distribute, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<SeasonPool>, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>[]>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SeasonPool, undefined>>;
  Season_Fund: 
    damlTypes.Choice<SeasonPool, Season_Fund, damlTypes.ContractId<SeasonPool>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SeasonPool, undefined>>;
  Season_WithdrawRemainder: 
    damlTypes.Choice<SeasonPool, Season_WithdrawRemainder, damlTypes.Optional<damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SeasonPool, undefined>>;
}
export declare const SeasonPool:
  damlTypes.Template<SeasonPool, undefined, '#abu-pm-games:PM.Games.Season:SeasonPool'> &
  damlTypes.ToInterface<SeasonPool, never> &
  SeasonPoolInterface

export declare type Season_Distribute = {
  payouts: Payout[],
}

export declare const Season_Distribute:
  damlTypes.Serializable<Season_Distribute>

export declare type Season_Fund = {
  cash: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>[],
}

export declare const Season_Fund:
  damlTypes.Serializable<Season_Fund>

export declare type Season_WithdrawRemainder = {
}

export declare const Season_WithdrawRemainder:
  damlTypes.Serializable<Season_WithdrawRemainder>
