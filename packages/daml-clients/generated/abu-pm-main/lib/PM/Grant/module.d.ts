// Generated from ../../PM/Grant/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Leg from '../../PM/Leg/module';
import * as PM_Money from '../../PM/Money/module';
import * as PM_Quote from '../../PM/Quote/module';
import * as PM_Types from '../../PM/Types/module';

export declare type AgentGrant = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  agent: damlTypes.Party,
  caps: GrantCaps,
  budget: damlTypes.Int,
  expiresAt: damlTypes.Time,
  dayZero: damlTypes.Time,
  day: damlTypes.Int,
  spentToday: damlTypes.Int,
  positions: GrantPosition[],
}

export declare interface AgentGrantInterface {
  Archive: 
    damlTypes.Choice<AgentGrant, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<AgentGrant, undefined>>;
  Grant_AcceptQuote: 
    damlTypes.Choice<AgentGrant, Grant_AcceptQuote, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<AgentGrant>, damlTypes.ContractId<PM_Leg.Leg>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<AgentGrant, undefined>>;
  Grant_Revoke: 
    damlTypes.Choice<AgentGrant, Grant_Revoke, damlTypes.Optional<damlTypes.ContractId<PM_Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<AgentGrant, undefined>>;
}
export declare const AgentGrant:
  damlTypes.Template<AgentGrant, undefined, '#abu-pm-main:PM.Grant:AgentGrant'> &
  damlTypes.ToInterface<AgentGrant, never> &
  AgentGrantInterface

export declare type CapInput = {
  caps: GrantCaps,
  budget: damlTypes.Int,
  spentToday: damlTypes.Int,
  openPositions: damlTypes.Int,
  opensNewPosition: boolean,
  limitTicks: damlTypes.Int,
  priceTicks: damlTypes.Int,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  fee: damlTypes.Int,
}

export declare const CapInput:
  damlTypes.Serializable<CapInput>

export declare type GrantCaps = {
  maxStakePerTrade: damlTypes.Int,
  maxDailySpend: damlTypes.Int,
  maxPriceTicks: damlTypes.Int,
  maxOpenPositions: damlTypes.Int,
}

export declare const GrantCaps:
  damlTypes.Serializable<GrantCaps>

export declare type GrantOffer = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
}

export declare interface GrantOfferInterface {
  Archive: 
    damlTypes.Choice<GrantOffer, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GrantOffer, undefined>>;
  GrantOffer_Open: 
    damlTypes.Choice<GrantOffer, GrantOffer_Open, damlTypes.ContractId<AgentGrant>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GrantOffer, undefined>>;
}
export declare const GrantOffer:
  damlTypes.Template<GrantOffer, undefined, '#abu-pm-main:PM.Grant:GrantOffer'> &
  damlTypes.ToInterface<GrantOffer, never> &
  GrantOfferInterface

export declare type GrantOffer_Open = {
  agent: damlTypes.Party,
  caps: GrantCaps,
  expiresAt: damlTypes.Time,
  dayZero: damlTypes.Time,
  budget: damlTypes.Int,
  cash: damlTypes.ContractId<PM_Money.VenueCash>[],
}

export declare const GrantOffer_Open:
  damlTypes.Serializable<GrantOffer_Open>

export declare type GrantPosition = {
  marketId: string,
  outcome: PM_Types.Side,
  refundAfter: damlTypes.Time,
}

export declare const GrantPosition:
  damlTypes.Serializable<GrantPosition>

export declare type Grant_AcceptQuote = {
  quoteCid: damlTypes.ContractId<PM_Quote.Quote>,
  limitTicks: damlTypes.Int,
  asOf: damlTypes.Time,
}

export declare const Grant_AcceptQuote:
  damlTypes.Serializable<Grant_AcceptQuote>

export declare type Grant_Revoke = {
}

export declare const Grant_Revoke:
  damlTypes.Serializable<Grant_Revoke>
