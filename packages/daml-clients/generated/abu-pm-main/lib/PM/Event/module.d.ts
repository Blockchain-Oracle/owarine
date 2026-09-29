// Generated from ../../PM/Event/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Market from '../../PM/Market/module';
import * as PM_Types from '../../PM/Types/module';

export declare type AttestationEvidence = {
  attestor: damlTypes.Party,
  answer: boolean,
  attestedAt: damlTypes.Time,
  statementHash: string,
  attestationCid: damlTypes.ContractId<EventAttestation>,
}

export declare const AttestationEvidence:
  damlTypes.Serializable<AttestationEvidence>

export declare type Attestation_Retire = {
}

export declare const Attestation_Retire:
  damlTypes.Serializable<Attestation_Retire>

export declare type EventAttestation = {
  attestor: damlTypes.Party,
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  marketId: string,
  answer: boolean,
  attestedAt: damlTypes.Time,
  statementHash: string,
}

export declare interface EventAttestationInterface {
  Archive: 
    damlTypes.Choice<EventAttestation, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventAttestation, undefined>>;
  Attestation_Retire: 
    damlTypes.Choice<EventAttestation, Attestation_Retire, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventAttestation, undefined>>;
}
export declare const EventAttestation:
  damlTypes.Template<EventAttestation, undefined, '#abu-pm-main:PM.Event:EventAttestation'> &
  damlTypes.ToInterface<EventAttestation, never> &
  EventAttestationInterface

export declare type EventState = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
}

export declare interface EventStateInterface {
  Archive: 
    damlTypes.Choice<EventState, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventState, undefined>>;
}
export declare const EventState:
  damlTypes.Template<EventState, undefined, '#abu-pm-main:PM.Event:EventState'> &
  damlTypes.ToInterface<EventState, never> &
  EventStateInterface

export declare type EventTerms = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  question: string,
  closeTime: damlTypes.Time,
  closeDeadline: damlTypes.Time,
  attestors: damlTypes.Party[],
  quorum: damlTypes.Int,
}

export declare interface EventTermsInterface {
  Archive: 
    damlTypes.Choice<EventTerms, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventTerms, undefined>>;
  Event_Resolve: 
    damlTypes.Choice<EventTerms, Event_Resolve, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<PM_Market.Resolution>, damlTypes.ContractId<EventVerdict>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventTerms, undefined>>;
  Event_Void: 
    damlTypes.Choice<EventTerms, Event_Void, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<PM_Market.Resolution>, damlTypes.ContractId<EventVerdict>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventTerms, undefined>>;
}
export declare const EventTerms:
  damlTypes.Template<EventTerms, undefined, '#abu-pm-main:PM.Event:EventTerms'> &
  damlTypes.ToInterface<EventTerms, never> &
  EventTermsInterface

export declare type EventVerdict = {
  venue: damlTypes.Party,
  resolver: damlTypes.Party,
  termsCid: damlTypes.ContractId<PM_Market.MarketTerms>,
  marketId: string,
  question: string,
  answer: damlTypes.Optional<boolean>,
  voidReason: damlTypes.Optional<PM_Types.VoidReason>,
  attestations: AttestationEvidence[],
  resolutionCid: damlTypes.ContractId<PM_Market.Resolution>,
}

export declare interface EventVerdictInterface {
  Archive: 
    damlTypes.Choice<EventVerdict, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<EventVerdict, undefined>>;
}
export declare const EventVerdict:
  damlTypes.Template<EventVerdict, undefined, '#abu-pm-main:PM.Event:EventVerdict'> &
  damlTypes.ToInterface<EventVerdict, never> &
  EventVerdictInterface

export declare type Event_Resolve = {
  stateCid: damlTypes.ContractId<EventState>,
  attestationCids: damlTypes.ContractId<EventAttestation>[],
}

export declare const Event_Resolve:
  damlTypes.Serializable<Event_Resolve>

export declare type Event_Void = {
  stateCid: damlTypes.ContractId<EventState>,
  attestationCids: damlTypes.ContractId<EventAttestation>[],
}

export declare const Event_Void:
  damlTypes.Serializable<Event_Void>
