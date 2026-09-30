// Generated from ../../../PM/Tickets/Parlay/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 from '@daml.js/abu-pm-main-0.5.1';
import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Tickets_Common from '../../../PM/Tickets/Common/module';

export declare type ParlayLeg = {
  termsCid: damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Market.MarketTerms>,
  marketId: string,
  side: pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Types.Side,
  expiry: damlTypes.Time,
  refundAfter: damlTypes.Time,
  won: boolean,
}

export declare const ParlayLeg:
  damlTypes.Serializable<ParlayLeg>

export declare type ParlayQuote = {
  venue: damlTypes.Party,
  user: damlTypes.Party,
  reserveId: string,
  legs: ParlayLeg[],
  stake: damlTypes.Int,
  maxPayout: damlTypes.Int,
  validUntil: damlTypes.Time,
  voidAfter: damlTypes.Time,
}

export declare interface ParlayQuoteInterface {
  Archive: 
    damlTypes.Choice<ParlayQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayQuote, undefined>>;
  ParlayQuote_Accept: 
    damlTypes.Choice<ParlayQuote, ParlayQuote_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<ParlayTicket>, damlTypes.Optional<damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayQuote, undefined>>;
  ParlayQuote_Expire: 
    damlTypes.Choice<ParlayQuote, ParlayQuote_Expire, damlTypes.Optional<damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayQuote, undefined>>;
  ParlayQuote_Withdraw: 
    damlTypes.Choice<ParlayQuote, ParlayQuote_Withdraw, damlTypes.Optional<damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayQuote, undefined>>;
}
export declare const ParlayQuote:
  damlTypes.Template<ParlayQuote, undefined, '#abu-pm-tickets:PM.Tickets.Parlay:ParlayQuote'> &
  damlTypes.ToInterface<ParlayQuote, never> &
  ParlayQuoteInterface

export declare type ParlayQuote_Accept = {
  cash: damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>[],
}

export declare const ParlayQuote_Accept:
  damlTypes.Serializable<ParlayQuote_Accept>

export declare type ParlayQuote_Expire = {
}

export declare const ParlayQuote_Expire:
  damlTypes.Serializable<ParlayQuote_Expire>

export declare type ParlayQuote_Withdraw = {
  reason: string,
}

export declare const ParlayQuote_Withdraw:
  damlTypes.Serializable<ParlayQuote_Withdraw>

export declare type ParlayStep =
  | { tag: 'LegWon'; value: ParlayStep.LegWon }
  | { tag: 'TicketWon'; value: ParlayStep.TicketWon }
  | { tag: 'TicketLost'; value: ParlayStep.TicketLost }
  | { tag: 'TicketVoid'; value: ParlayStep.TicketVoid }


export declare const ParlayStep:
  damlTypes.Serializable<ParlayStep> & {
    LegWon: damlTypes.Serializable<ParlayStep.LegWon>;
    TicketLost: damlTypes.Serializable<ParlayStep.TicketLost>;
    TicketVoid: damlTypes.Serializable<ParlayStep.TicketVoid>;
    TicketWon: damlTypes.Serializable<ParlayStep.TicketWon>;
  }

export namespace ParlayStep {
  type LegWon = {
    ticketCid: damlTypes.ContractId<ParlayTicket>,
  }
  type TicketLost = {
    paid: PM_Tickets_Common.Paid,
  }
  type TicketVoid = {
    paid: PM_Tickets_Common.Paid,
  }
  type TicketWon = {
    paid: PM_Tickets_Common.Paid,
  }
}

export declare type ParlayTicket = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  reserveId: string,
  legs: ParlayLeg[],
  stake: damlTypes.Int,
  maxPayout: damlTypes.Int,
  voidAfter: damlTypes.Time,
}

export declare interface ParlayTicketInterface {
  Archive: 
    damlTypes.Choice<ParlayTicket, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayTicket, undefined>>;
  Ticket_ClaimLeg: 
    damlTypes.Choice<ParlayTicket, Ticket_ClaimLeg, ParlayStep, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayTicket, undefined>>;
  Ticket_ResolveLeg: 
    damlTypes.Choice<ParlayTicket, Ticket_ResolveLeg, ParlayStep, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayTicket, undefined>>;
  Ticket_VoidStale: 
    damlTypes.Choice<ParlayTicket, Ticket_VoidStale, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ParlayTicket, undefined>>;
}
export declare const ParlayTicket:
  damlTypes.Template<ParlayTicket, undefined, '#abu-pm-tickets:PM.Tickets.Parlay:ParlayTicket'> &
  damlTypes.ToInterface<ParlayTicket, never> &
  ParlayTicketInterface

export declare type Ticket_ClaimLeg = {
  resolutionCid: damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Market.Resolution>,
}

export declare const Ticket_ClaimLeg:
  damlTypes.Serializable<Ticket_ClaimLeg>

export declare type Ticket_ResolveLeg = {
  resolutionCid: damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Market.Resolution>,
}

export declare const Ticket_ResolveLeg:
  damlTypes.Serializable<Ticket_ResolveLeg>

export declare type Ticket_VoidStale = {
}

export declare const Ticket_VoidStale:
  damlTypes.Serializable<Ticket_VoidStale>
