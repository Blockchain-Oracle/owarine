// Generated from ../../../PM/Games/Arena/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550 from '@daml.js/abu-pm-main-0.5.0';

export declare type ArenaParams = {
  joinWindowSec: damlTypes.Int,
  revealWindowSec: damlTypes.Int,
  pickWindowSec: damlTypes.Int,
  minDeckSize: damlTypes.Int,
  maxDeckSize: damlTypes.Int,
}

export declare const ArenaParams:
  damlTypes.Serializable<ArenaParams>

export declare type ArenaTerms = {
  venue: damlTypes.Party,
  arenaId: string,
  policyVersion: damlTypes.Int,
  params: ArenaParams,
  tiers: Tier[],
}

export declare interface ArenaTermsInterface {
  Archive: 
    damlTypes.Choice<ArenaTerms, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ArenaTerms, undefined>>;
  Arena_OpenDuel: 
    damlTypes.Choice<ArenaTerms, Arena_OpenDuel, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<DuelOpen>, damlTypes.Optional<damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ArenaTerms, undefined>>;
  Arena_Update: 
    damlTypes.Choice<ArenaTerms, Arena_Update, damlTypes.ContractId<ArenaTerms>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ArenaTerms, undefined>>;
}
export declare const ArenaTerms:
  damlTypes.Template<ArenaTerms, undefined, '#abu-pm-games:PM.Games.Arena:ArenaTerms'> &
  damlTypes.ToInterface<ArenaTerms, never> &
  ArenaTermsInterface

export declare type Arena_OpenDuel = {
  creator: damlTypes.Party,
  challenger: damlTypes.Party,
  matchId: string,
  tierId: string,
  deckHash: string,
  deckSize: damlTypes.Int,
  clientSeeds: string[],
  joinDeadline: damlTypes.Time,
  cash: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>[],
}

export declare const Arena_OpenDuel:
  damlTypes.Serializable<Arena_OpenDuel>

export declare type Arena_Update = {
  newParams: ArenaParams,
  newTiers: Tier[],
}

export declare const Arena_Update:
  damlTypes.Serializable<Arena_Update>

export declare type Card = {
  termsCid: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Market.MarketTerms>,
  marketId: string,
  lockAt: damlTypes.Time,
  refundAfter: damlTypes.Time,
}

export declare const Card:
  damlTypes.Serializable<Card>

export declare type DuelMatch = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  challenger: damlTypes.Party,
  arenaId: string,
  matchId: string,
  policyVersion: damlTypes.Int,
  tier: Tier,
  params: ArenaParams,
  deckHash: string,
  deckSize: damlTypes.Int,
  clientSeeds: string[],
  revealDeadline: damlTypes.Time,
  status: DuelStatus,
  serverSeed: damlTypes.Optional<string>,
  cards: Card[],
  pickDeadline: damlTypes.Optional<damlTypes.Time>,
  picks: Pick[],
}

export declare interface DuelMatchInterface {
  Archive: 
    damlTypes.Choice<DuelMatch, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_Finalize: 
    damlTypes.Choice<DuelMatch, Duel_Finalize, damlTypes.ContractId<DuelResult>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_Lock: 
    damlTypes.Choice<DuelMatch, Duel_Lock, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Either<damlTypes.ContractId<DuelResult>, damlTypes.ContractId<DuelMatch>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_RecordPick: 
    damlTypes.Choice<DuelMatch, Duel_RecordPick, damlTypes.ContractId<DuelMatch>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_RefundStale: 
    damlTypes.Choice<DuelMatch, Duel_RefundStale, damlTypes.ContractId<DuelResult>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_RefundUnrevealed: 
    damlTypes.Choice<DuelMatch, Duel_RefundUnrevealed, damlTypes.ContractId<DuelResult>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_Reveal: 
    damlTypes.Choice<DuelMatch, Duel_Reveal, damlTypes.ContractId<DuelMatch>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
  Duel_Score: 
    damlTypes.Choice<DuelMatch, Duel_Score, damlTypes.ContractId<DuelMatch>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelMatch, undefined>>;
}
export declare const DuelMatch:
  damlTypes.Template<DuelMatch, undefined, '#abu-pm-games:PM.Games.Arena:DuelMatch'> &
  damlTypes.ToInterface<DuelMatch, never> &
  DuelMatchInterface

export declare type DuelOpen = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  challenger: damlTypes.Party,
  arenaId: string,
  matchId: string,
  policyVersion: damlTypes.Int,
  tier: Tier,
  params: ArenaParams,
  deckHash: string,
  deckSize: damlTypes.Int,
  clientSeeds: string[],
  joinDeadline: damlTypes.Time,
}

export declare interface DuelOpenInterface {
  Archive: 
    damlTypes.Choice<DuelOpen, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelOpen, undefined>>;
  Open_Cancel: 
    damlTypes.Choice<DuelOpen, Open_Cancel, damlTypes.Optional<damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelOpen, undefined>>;
  Open_Join: 
    damlTypes.Choice<DuelOpen, Open_Join, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<DuelMatch>, damlTypes.Optional<damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelOpen, undefined>>;
  Open_RefundUnjoined: 
    damlTypes.Choice<DuelOpen, Open_RefundUnjoined, damlTypes.Optional<damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelOpen, undefined>>;
}
export declare const DuelOpen:
  damlTypes.Template<DuelOpen, undefined, '#abu-pm-games:PM.Games.Arena:DuelOpen'> &
  damlTypes.ToInterface<DuelOpen, never> &
  DuelOpenInterface

export declare type DuelOutcome =
  | { tag: 'Won'; value: DuelOutcome.Won }
  | { tag: 'Tied'; value: {} }
  | { tag: 'Refunded'; value: DuelOutcome.Refunded }


export declare const DuelOutcome:
  damlTypes.Serializable<DuelOutcome> & {
    Refunded: damlTypes.Serializable<DuelOutcome.Refunded>;
    Won: damlTypes.Serializable<DuelOutcome.Won>;
  }

export namespace DuelOutcome {
  type Refunded = {
    reason: RefundReason,
  }
  type Won = {
    winner: damlTypes.Party,
  }
}

export declare type DuelResult = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  challenger: damlTypes.Party,
  arenaId: string,
  matchId: string,
  tierId: string,
  ranked: boolean,
  outcome: DuelOutcome,
  creatorPnl: damlTypes.Int,
  challengerPnl: damlTypes.Int,
  toCreator: damlTypes.Int,
  toChallenger: damlTypes.Int,
  serverSeed: damlTypes.Optional<string>,
  cards: string[],
}

export declare interface DuelResultInterface {
  Archive: 
    damlTypes.Choice<DuelResult, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DuelResult, undefined>>;
}
export declare const DuelResult:
  damlTypes.Template<DuelResult, undefined, '#abu-pm-games:PM.Games.Arena:DuelResult'> &
  damlTypes.ToInterface<DuelResult, never> &
  DuelResultInterface

export declare type DuelStatus =
  | { tag: 'Unrevealed'; value: {} }
  | { tag: 'Picking'; value: {} }
  | { tag: 'Settling'; value: {} }
  | { tag: 'Forfeited'; value: DuelStatus.Forfeited }


export declare const DuelStatus:
  damlTypes.Serializable<DuelStatus> & {
    Forfeited: damlTypes.Serializable<DuelStatus.Forfeited>;
  }

export namespace DuelStatus {
  type Forfeited = {
    absent: damlTypes.Party,
  }
}

export declare type Duel_Finalize = {
  actor: damlTypes.Party,
}

export declare const Duel_Finalize:
  damlTypes.Serializable<Duel_Finalize>

export declare type Duel_Lock = {
  actor: damlTypes.Party,
}

export declare const Duel_Lock:
  damlTypes.Serializable<Duel_Lock>

export declare type Duel_RecordPick = {
  player: damlTypes.Party,
  cardIndex: damlTypes.Int,
  legCid: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Leg.Leg>,
}

export declare const Duel_RecordPick:
  damlTypes.Serializable<Duel_RecordPick>

export declare type Duel_RefundStale = {
  actor: damlTypes.Party,
}

export declare const Duel_RefundStale:
  damlTypes.Serializable<Duel_RefundStale>

export declare type Duel_RefundUnrevealed = {
  actor: damlTypes.Party,
}

export declare const Duel_RefundUnrevealed:
  damlTypes.Serializable<Duel_RefundUnrevealed>

export declare type Duel_Reveal = {
  actor: damlTypes.Party,
  seed: string,
  cardCids: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Market.MarketTerms>[],
  newPickDeadline: damlTypes.Time,
}

export declare const Duel_Reveal:
  damlTypes.Serializable<Duel_Reveal>

export declare type Duel_Score = {
  actor: damlTypes.Party,
  items: ScoreItem[],
}

export declare const Duel_Score:
  damlTypes.Serializable<Duel_Score>

export declare type Open_Cancel = {
}

export declare const Open_Cancel:
  damlTypes.Serializable<Open_Cancel>

export declare type Open_Join = {
  cash: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>[],
  revealDeadline: damlTypes.Time,
}

export declare const Open_Join:
  damlTypes.Serializable<Open_Join>

export declare type Open_RefundUnjoined = {
  actor: damlTypes.Party,
}

export declare const Open_RefundUnjoined:
  damlTypes.Serializable<Open_RefundUnjoined>

export declare type Pick = {
  seat: damlTypes.Int,
  cardIndex: damlTypes.Int,
  legCid: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Leg.Leg>,
  leg: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Leg.Leg,
  cost: damlTypes.Int,
  payout: damlTypes.Optional<damlTypes.Int>,
}

export declare const Pick:
  damlTypes.Serializable<Pick>

export declare type RefundReason =
  | 'BothIncomplete'
  | 'RevealUnavailable'
  | 'StaleSettlement'


export declare const RefundReason:
  damlTypes.Serializable<RefundReason> & { readonly keys: RefundReason[] } & { readonly [e in RefundReason]: e }

export declare type ScoreItem = {
  seat: damlTypes.Int,
  cardIndex: damlTypes.Int,
  resolutionCid: damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Market.Resolution>,
}

export declare const ScoreItem:
  damlTypes.Serializable<ScoreItem>

export declare type Tier = {
  tierId: string,
  potEach: damlTypes.Int,
  perCardCap: damlTypes.Int,
  ranked: boolean,
  enabled: boolean,
}

export declare const Tier:
  damlTypes.Serializable<Tier>
