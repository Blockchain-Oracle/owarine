// Generated from ../../../PM/Agents/Strategy/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a from '@daml.js/abu-pm-main-0.5.2';

export declare type CreatorLicense = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  nextIndex: damlTypes.Int,
}

export declare interface CreatorLicenseInterface {
  Archive: 
    damlTypes.Choice<CreatorLicense, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CreatorLicense, undefined>>;
  License_Payout: 
    damlTypes.Choice<CreatorLicense, License_Payout, damlTypes.ContractId<CreatorPayout>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CreatorLicense, undefined>>;
  License_Publish: 
    damlTypes.Choice<CreatorLicense, License_Publish, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<CreatorLicense>, damlTypes.ContractId<Strategy>, damlTypes.ContractId<StrategyListing>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CreatorLicense, undefined>>;
}
export declare const CreatorLicense:
  damlTypes.Template<CreatorLicense, undefined, '#abu-pm-agents:PM.Agents.Strategy:CreatorLicense'> &
  damlTypes.ToInterface<CreatorLicense, never> &
  CreatorLicenseInterface

export declare type CreatorPayout = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  period: damlTypes.Int,
  feeCount: damlTypes.Int,
  amount: damlTypes.Int,
}

export declare interface CreatorPayoutInterface {
  Archive: 
    damlTypes.Choice<CreatorPayout, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CreatorPayout, undefined>>;
  Payout_Claim: 
    damlTypes.Choice<CreatorPayout, Payout_Claim, damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CreatorPayout, undefined>>;
}
export declare const CreatorPayout:
  damlTypes.Template<CreatorPayout, undefined, '#abu-pm-agents:PM.Agents.Strategy:CreatorPayout'> &
  damlTypes.ToInterface<CreatorPayout, never> &
  CreatorPayoutInterface

export declare type Envelope = {
  maxStakePerTrade: damlTypes.Int,
  maxDailySpend: damlTypes.Int,
  maxOpenPositions: damlTypes.Int,
  maxPriceTicks: damlTypes.Int,
}

export declare const Envelope:
  damlTypes.Serializable<Envelope>

export declare type Invite_OpenBook = {
}

export declare const Invite_OpenBook:
  damlTypes.Serializable<Invite_OpenBook>

export declare type License_Payout = {
  feeCids: damlTypes.ContractId<StrategyFee>[],
  period: damlTypes.Int,
}

export declare const License_Payout:
  damlTypes.Serializable<License_Payout>

export declare type License_Publish = {
  runner: damlTypes.Party,
  envelope: Envelope,
  fee: damlTypes.Int,
  spec: string,
  specHash: string,
}

export declare const License_Publish:
  damlTypes.Serializable<License_Publish>

export declare type Listing_Sync = {
  strategyCid: damlTypes.ContractId<Strategy>,
}

export declare const Listing_Sync:
  damlTypes.Serializable<Listing_Sync>

export declare type Payout_Claim = {
}

export declare const Payout_Claim:
  damlTypes.Serializable<Payout_Claim>

export declare type Strategy = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  strategyId: string,
  runner: damlTypes.Party,
  envelope: Envelope,
  fee: damlTypes.Int,
  spec: string,
  specHash: string,
  version: damlTypes.Int,
  active: boolean,
  publishedAt: damlTypes.Optional<damlTypes.Time>,
}

export declare interface StrategyInterface {
  Archive: 
    damlTypes.Choice<Strategy, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Strategy, undefined>>;
  Strategy_Deactivate: 
    damlTypes.Choice<Strategy, Strategy_Deactivate, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<Strategy>, damlTypes.ContractId<StrategyListing>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Strategy, undefined>>;
  Strategy_SetRunner: 
    damlTypes.Choice<Strategy, Strategy_SetRunner, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<Strategy>, damlTypes.ContractId<StrategyListing>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Strategy, undefined>>;
  Strategy_Update: 
    damlTypes.Choice<Strategy, Strategy_Update, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<Strategy>, damlTypes.ContractId<StrategyListing>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Strategy, undefined>>;
}
export declare const Strategy:
  damlTypes.Template<Strategy, undefined, '#abu-pm-agents:PM.Agents.Strategy:Strategy'> &
  damlTypes.ToInterface<Strategy, never> &
  StrategyInterface

export declare type StrategyFee = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  strategyId: string,
  amount: damlTypes.Int,
}

export declare interface StrategyFeeInterface {
  Archive: 
    damlTypes.Choice<StrategyFee, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<StrategyFee, undefined>>;
}
export declare const StrategyFee:
  damlTypes.Template<StrategyFee, undefined, '#abu-pm-agents:PM.Agents.Strategy:StrategyFee'> &
  damlTypes.ToInterface<StrategyFee, never> &
  StrategyFeeInterface

export declare type StrategyListing = {
  venue: damlTypes.Party,
  creator: damlTypes.Party,
  strategyId: string,
  strategyCid: damlTypes.ContractId<Strategy>,
  runner: damlTypes.Party,
  envelope: Envelope,
  fee: damlTypes.Int,
  specHash: string,
  version: damlTypes.Int,
  active: boolean,
  publishedAt: damlTypes.Optional<damlTypes.Time>,
}

export declare interface StrategyListingInterface {
  Archive: 
    damlTypes.Choice<StrategyListing, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<StrategyListing, undefined>>;
  Listing_Sync: 
    damlTypes.Choice<StrategyListing, Listing_Sync, damlTypes.ContractId<StrategyListing>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<StrategyListing, undefined>>;
}
export declare const StrategyListing:
  damlTypes.Template<StrategyListing, undefined, '#abu-pm-agents:PM.Agents.Strategy:StrategyListing'> &
  damlTypes.ToInterface<StrategyListing, never> &
  StrategyListingInterface

export declare type Strategy_Deactivate = {
  listingCid: damlTypes.ContractId<StrategyListing>,
}

export declare const Strategy_Deactivate:
  damlTypes.Serializable<Strategy_Deactivate>

export declare type Strategy_SetRunner = {
  newRunner: damlTypes.Party,
  listingCid: damlTypes.ContractId<StrategyListing>,
}

export declare const Strategy_SetRunner:
  damlTypes.Serializable<Strategy_SetRunner>

export declare type Strategy_Update = {
  newSpec: string,
  newSpecHash: string,
  newFee: damlTypes.Int,
  listingCid: damlTypes.ContractId<StrategyListing>,
}

export declare const Strategy_Update:
  damlTypes.Serializable<Strategy_Update>

export declare type SubKind =
  | 'SubCopy'
  | 'SubFade'
  | 'SubMirror'


export declare const SubKind:
  damlTypes.Serializable<SubKind> & { readonly keys: SubKind[] } & { readonly [e in SubKind]: e }

export declare type SubscriberBook = {
  venue: damlTypes.Party,
  subscriber: damlTypes.Party,
  following: string[],
}

export declare interface SubscriberBookInterface {
  Archive: 
    damlTypes.Choice<SubscriberBook, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SubscriberBook, undefined>>;
  Subscriber_Subscribe: 
    damlTypes.Choice<SubscriberBook, Subscriber_Subscribe, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<SubscriberBook>, damlTypes.ContractId<Subscription>, damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SubscriberBook, undefined>>;
  Subscriber_Unsubscribe: 
    damlTypes.Choice<SubscriberBook, Subscriber_Unsubscribe, damlTypes.ContractId<SubscriberBook>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SubscriberBook, undefined>>;
}
export declare const SubscriberBook:
  damlTypes.Template<SubscriberBook, undefined, '#abu-pm-agents:PM.Agents.Strategy:SubscriberBook'> &
  damlTypes.ToInterface<SubscriberBook, never> &
  SubscriberBookInterface

export declare type SubscriberInvite = {
  venue: damlTypes.Party,
  subscriber: damlTypes.Party,
}

export declare interface SubscriberInviteInterface {
  Archive: 
    damlTypes.Choice<SubscriberInvite, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SubscriberInvite, undefined>>;
  Invite_OpenBook: 
    damlTypes.Choice<SubscriberInvite, Invite_OpenBook, damlTypes.ContractId<SubscriberBook>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<SubscriberInvite, undefined>>;
}
export declare const SubscriberInvite:
  damlTypes.Template<SubscriberInvite, undefined, '#abu-pm-agents:PM.Agents.Strategy:SubscriberInvite'> &
  damlTypes.ToInterface<SubscriberInvite, never> &
  SubscriberInviteInterface

export declare type Subscriber_Subscribe = {
  listingCid: damlTypes.ContractId<StrategyListing>,
  grantCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Grant.AgentGrant>,
  kind: SubKind,
  maxFee: damlTypes.Int,
  expectVersion: damlTypes.Int,
  cash: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>[],
}

export declare const Subscriber_Subscribe:
  damlTypes.Serializable<Subscriber_Subscribe>

export declare type Subscriber_Unsubscribe = {
  subscriptionCid: damlTypes.ContractId<Subscription>,
}

export declare const Subscriber_Unsubscribe:
  damlTypes.Serializable<Subscriber_Unsubscribe>

export declare type Subscription = {
  venue: damlTypes.Party,
  subscriber: damlTypes.Party,
  creator: damlTypes.Party,
  strategyId: string,
  runner: damlTypes.Party,
  kind: SubKind,
  version: damlTypes.Int,
  specHash: string,
  grantCid: damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Grant.AgentGrant>,
  feePaid: damlTypes.Int,
}

export declare interface SubscriptionInterface {
  Archive: 
    damlTypes.Choice<Subscription, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Subscription, undefined>>;
}
export declare const Subscription:
  damlTypes.Template<Subscription, undefined, '#abu-pm-agents:PM.Agents.Strategy:Subscription'> &
  damlTypes.ToInterface<Subscription, never> &
  SubscriptionInterface
