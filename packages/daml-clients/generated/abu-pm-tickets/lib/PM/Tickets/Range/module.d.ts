// Generated from ../../../PM/Tickets/Range/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d from '@daml.js/abu-pm-main-0.4.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Tickets_Common from '../../../PM/Tickets/Common/module';

export declare type RangeKind =
  | 'RangeTicket'
  | 'Moonshot'


export declare const RangeKind:
  damlTypes.Serializable<RangeKind> & { readonly keys: RangeKind[] } & { readonly [e in RangeKind]: e }

export declare type RangeQuote = {
  venue: damlTypes.Party,
  user: damlTypes.Party,
  reserveId: string,
  termsCid: damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Market.MarketTerms>,
  marketId: string,
  kind: RangeKind,
  side: RangeSide,
  lowE8: damlTypes.Int,
  highE8: damlTypes.Int,
  stake: damlTypes.Int,
  maxPayout: damlTypes.Int,
  validUntil: damlTypes.Time,
  lockAt: damlTypes.Time,
  expiry: damlTypes.Time,
  refundAfter: damlTypes.Time,
}

export declare interface RangeQuoteInterface {
  Archive: 
    damlTypes.Choice<RangeQuote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeQuote, undefined>>;
  RangeQuote_Accept: 
    damlTypes.Choice<RangeQuote, RangeQuote_Accept, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<RangeRound>, damlTypes.Optional<damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeQuote, undefined>>;
  RangeQuote_Expire: 
    damlTypes.Choice<RangeQuote, RangeQuote_Expire, damlTypes.Optional<damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeQuote, undefined>>;
  RangeQuote_Withdraw: 
    damlTypes.Choice<RangeQuote, RangeQuote_Withdraw, damlTypes.Optional<damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeQuote, undefined>>;
}
export declare const RangeQuote:
  damlTypes.Template<RangeQuote, undefined, '#abu-pm-tickets:PM.Tickets.Range:RangeQuote'> &
  damlTypes.ToInterface<RangeQuote, never> &
  RangeQuoteInterface

export declare type RangeQuote_Accept = {
  cash: damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash>[],
}

export declare const RangeQuote_Accept:
  damlTypes.Serializable<RangeQuote_Accept>

export declare type RangeQuote_Expire = {
}

export declare const RangeQuote_Expire:
  damlTypes.Serializable<RangeQuote_Expire>

export declare type RangeQuote_Withdraw = {
  reason: string,
}

export declare const RangeQuote_Withdraw:
  damlTypes.Serializable<RangeQuote_Withdraw>

export declare type RangeRound = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  reserveId: string,
  termsCid: damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Market.MarketTerms>,
  marketId: string,
  kind: RangeKind,
  side: RangeSide,
  lowE8: damlTypes.Int,
  highE8: damlTypes.Int,
  stake: damlTypes.Int,
  maxPayout: damlTypes.Int,
  expiry: damlTypes.Time,
  refundAfter: damlTypes.Time,
}

export declare interface RangeRoundInterface {
  Archive: 
    damlTypes.Choice<RangeRound, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeRound, undefined>>;
  Round_Claim: 
    damlTypes.Choice<RangeRound, Round_Claim, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeRound, undefined>>;
  Round_RefundStale: 
    damlTypes.Choice<RangeRound, Round_RefundStale, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeRound, undefined>>;
  Round_Settle: 
    damlTypes.Choice<RangeRound, Round_Settle, PM_Tickets_Common.Paid, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RangeRound, undefined>>;
}
export declare const RangeRound:
  damlTypes.Template<RangeRound, undefined, '#abu-pm-tickets:PM.Tickets.Range:RangeRound'> &
  damlTypes.ToInterface<RangeRound, never> &
  RangeRoundInterface

export declare type RangeSide =
  | 'Inside'
  | 'Outside'


export declare const RangeSide:
  damlTypes.Serializable<RangeSide> & { readonly keys: RangeSide[] } & { readonly [e in RangeSide]: e }

export declare type Round_Claim = {
  resolutionCid: damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Market.Resolution>,
}

export declare const Round_Claim:
  damlTypes.Serializable<Round_Claim>

export declare type Round_RefundStale = {
}

export declare const Round_RefundStale:
  damlTypes.Serializable<Round_RefundStale>

export declare type Round_Settle = {
  resolutionCid: damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Market.Resolution>,
}

export declare const Round_Settle:
  damlTypes.Serializable<Round_Settle>
