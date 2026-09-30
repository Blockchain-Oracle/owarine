// Generated from ../../../PM/Agents/Desk/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';
import * as pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c from '@daml.js/abu-pm-main-0.5.0';

export declare type DeskAction =
  | { tag: 'DeskHold'; value: {} }
  | { tag: 'DeskTrade'; value: DeskAction.DeskTrade }
  | { tag: 'DeskSell'; value: DeskAction.DeskSell }


export declare const DeskAction:
  damlTypes.Serializable<DeskAction> & {
    DeskSell: damlTypes.Serializable<DeskAction.DeskSell>;
    DeskTrade: damlTypes.Serializable<DeskAction.DeskTrade>;
  }

export namespace DeskAction {
  type DeskSell = {
    marketId: string,
    side: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side,
    lots: damlTypes.Int,
    priceTicks: damlTypes.Int,
    referenceTicks: damlTypes.Int,
    proceeds: damlTypes.Int,
    counted: damlTypes.Int,
  }
  type DeskTrade = {
    marketId: string,
    side: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side,
    lots: damlTypes.Int,
    priceTicks: damlTypes.Int,
    referenceTicks: damlTypes.Int,
    charge: damlTypes.Int,
  }
}

export declare type DeskDecision = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  operator: damlTypes.Party,
  seq: damlTypes.Int,
  prevHead: string,
  decisionHash: string,
  head: string,
  action: DeskAction,
  note: string,
}

export declare interface DeskDecisionInterface {
  Archive: 
    damlTypes.Choice<DeskDecision, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskDecision, undefined>>;
}
export declare const DeskDecision:
  damlTypes.Template<DeskDecision, undefined, '#abu-pm-agents:PM.Agents.Desk:DeskDecision'> &
  damlTypes.ToInterface<DeskDecision, never> &
  DeskDecisionInterface

export declare type DeskHolding = {
  marketId: string,
  side: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side,
  lots: damlTypes.Int,
  refundAfter: damlTypes.Time,
}

export declare const DeskHolding:
  damlTypes.Serializable<DeskHolding>

export declare type DeskMandate = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  operator: damlTypes.Optional<damlTypes.Party>,
  grant: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Grant.AgentGrant,
  allowList: string[],
  maxPremiumBps: damlTypes.Int,
  attestors: damlTypes.Party[],
  refQuorum: damlTypes.Int,
  mode: DeskMode,
  paused: boolean,
  head: string,
  seq: damlTypes.Int,
  holdings: damlTypes.Optional<DeskHolding[]>,
}

export declare interface DeskMandateInterface {
  Archive: 
    damlTypes.Choice<DeskMandate, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Checkpoint: 
    damlTypes.Choice<DeskMandate, Mandate_Checkpoint, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<DeskMandate>, damlTypes.ContractId<DeskDecision>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Close: 
    damlTypes.Choice<DeskMandate, Mandate_Close, damlTypes.Optional<damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Deposit: 
    damlTypes.Choice<DeskMandate, Mandate_Deposit, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Pause: 
    damlTypes.Choice<DeskMandate, Mandate_Pause, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_RevokeOperator: 
    damlTypes.Choice<DeskMandate, Mandate_RevokeOperator, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Sell: 
    damlTypes.Choice<DeskMandate, Mandate_Sell, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<DeskMandate>, damlTypes.ContractId<DeskDecision>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_SetAllowList: 
    damlTypes.Choice<DeskMandate, Mandate_SetAllowList, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_SetLimits: 
    damlTypes.Choice<DeskMandate, Mandate_SetLimits, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_SetMode: 
    damlTypes.Choice<DeskMandate, Mandate_SetMode, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_SetOperator: 
    damlTypes.Choice<DeskMandate, Mandate_SetOperator, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Trade: 
    damlTypes.Choice<DeskMandate, Mandate_Trade, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple3<damlTypes.ContractId<DeskMandate>, damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Leg.Leg>, damlTypes.ContractId<DeskDecision>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Unpause: 
    damlTypes.Choice<DeskMandate, Mandate_Unpause, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
  Mandate_Withdraw: 
    damlTypes.Choice<DeskMandate, Mandate_Withdraw, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<DeskMandate>, damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMandate, undefined>>;
}
export declare const DeskMandate:
  damlTypes.Template<DeskMandate, undefined, '#abu-pm-agents:PM.Agents.Desk:DeskMandate'> &
  damlTypes.ToInterface<DeskMandate, never> &
  DeskMandateInterface

export declare type DeskMark = {
  attestor: damlTypes.Party,
  venue: damlTypes.Party,
  marketId: string,
  side: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side,
  refTicks: damlTypes.Int,
  fetchedAt: damlTypes.Time,
}

export declare interface DeskMarkInterface {
  Archive: 
    damlTypes.Choice<DeskMark, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskMark, undefined>>;
}
export declare const DeskMark:
  damlTypes.Template<DeskMark, undefined, '#abu-pm-agents:PM.Agents.Desk:DeskMark'> &
  damlTypes.ToInterface<DeskMark, never> &
  DeskMarkInterface

export declare type DeskMode =
  | 'DeskLive'
  | 'DeskShadow'


export declare const DeskMode:
  damlTypes.Serializable<DeskMode> & { readonly keys: DeskMode[] } & { readonly [e in DeskMode]: e }

export declare type DeskOffer = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
}

export declare interface DeskOfferInterface {
  Archive: 
    damlTypes.Choice<DeskOffer, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskOffer, undefined>>;
  DeskOffer_Open: 
    damlTypes.Choice<DeskOffer, DeskOffer_Open, damlTypes.ContractId<DeskMandate>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<DeskOffer, undefined>>;
}
export declare const DeskOffer:
  damlTypes.Template<DeskOffer, undefined, '#abu-pm-agents:PM.Agents.Desk:DeskOffer'> &
  damlTypes.ToInterface<DeskOffer, never> &
  DeskOfferInterface

export declare type DeskOffer_Open = {
  operator: damlTypes.Party,
  caps: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Grant.GrantCaps,
  expiresAt: damlTypes.Time,
  dayZero: damlTypes.Time,
  budget: damlTypes.Int,
  cash: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>[],
  allowList: string[],
  maxPremiumBps: damlTypes.Int,
  attestors: damlTypes.Party[],
  refQuorum: damlTypes.Int,
  mode: DeskMode,
}

export declare const DeskOffer_Open:
  damlTypes.Serializable<DeskOffer_Open>

export declare type Mandate_Checkpoint = {
  actor: damlTypes.Party,
  prevHead: string,
  decisionHash: string,
  deadline: damlTypes.Time,
  note: string,
}

export declare const Mandate_Checkpoint:
  damlTypes.Serializable<Mandate_Checkpoint>

export declare type Mandate_Close = {
}

export declare const Mandate_Close:
  damlTypes.Serializable<Mandate_Close>

export declare type Mandate_Deposit = {
  cash: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>[],
}

export declare const Mandate_Deposit:
  damlTypes.Serializable<Mandate_Deposit>

export declare type Mandate_Pause = {
  actor: damlTypes.Party,
}

export declare const Mandate_Pause:
  damlTypes.Serializable<Mandate_Pause>

export declare type Mandate_RevokeOperator = {
}

export declare const Mandate_RevokeOperator:
  damlTypes.Serializable<Mandate_RevokeOperator>

export declare type Mandate_Sell = {
  actor: damlTypes.Party,
  buyQuoteCid: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Quote.BuyQuote>,
  asOf: damlTypes.Time,
  markCids: damlTypes.ContractId<DeskMark>[],
  prevHead: string,
  decisionHash: string,
  note: string,
}

export declare const Mandate_Sell:
  damlTypes.Serializable<Mandate_Sell>

export declare type Mandate_SetAllowList = {
  newAllowList: string[],
}

export declare const Mandate_SetAllowList:
  damlTypes.Serializable<Mandate_SetAllowList>

export declare type Mandate_SetLimits = {
  newCaps: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Grant.GrantCaps,
  newMaxPremiumBps: damlTypes.Int,
}

export declare const Mandate_SetLimits:
  damlTypes.Serializable<Mandate_SetLimits>

export declare type Mandate_SetMode = {
  newMode: DeskMode,
}

export declare const Mandate_SetMode:
  damlTypes.Serializable<Mandate_SetMode>

export declare type Mandate_SetOperator = {
  newOperator: damlTypes.Party,
}

export declare const Mandate_SetOperator:
  damlTypes.Serializable<Mandate_SetOperator>

export declare type Mandate_Trade = {
  actor: damlTypes.Party,
  quoteCid: damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Quote.Quote>,
  limitTicks: damlTypes.Int,
  asOf: damlTypes.Time,
  markCids: damlTypes.ContractId<DeskMark>[],
  prevHead: string,
  decisionHash: string,
  note: string,
}

export declare const Mandate_Trade:
  damlTypes.Serializable<Mandate_Trade>

export declare type Mandate_Unpause = {
}

export declare const Mandate_Unpause:
  damlTypes.Serializable<Mandate_Unpause>

export declare type Mandate_Withdraw = {
  amount: damlTypes.Int,
}

export declare const Mandate_Withdraw:
  damlTypes.Serializable<Mandate_Withdraw>
