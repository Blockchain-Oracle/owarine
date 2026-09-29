// Generated from ../../PM/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type PolicyVersion = {
  version: damlTypes.Int,
  effectiveFrom: damlTypes.Time,
  validUntil: damlTypes.Optional<damlTypes.Time>,
  printSource: string,
  minDelaySec: damlTypes.Int,
  barLenSec: damlTypes.Int,
  openAdmissionSec: damlTypes.Int,
  closeAdmissionSec: damlTypes.Int,
}

export declare const PolicyVersion:
  damlTypes.Serializable<PolicyVersion>

export declare type Side =
  | 'SideUp'
  | 'SideDown'


export declare const Side:
  damlTypes.Serializable<Side> & { readonly keys: Side[] } & { readonly [e in Side]: e }

export declare type Slot =
  | 'OpenSlot'
  | 'CloseSlot'


export declare const Slot:
  damlTypes.Serializable<Slot> & { readonly keys: Slot[] } & { readonly [e in Slot]: e }

export declare type VoidReason =
  | { tag: 'MissingPrint'; value: VoidReason.MissingPrint }
  | { tag: 'QuorumNotMet'; value: VoidReason.QuorumNotMet }
  | { tag: 'ResolverAbsent'; value: VoidReason.ResolverAbsent }
  | { tag: 'SourceDisagreement'; value: VoidReason.SourceDisagreement }


export declare const VoidReason:
  damlTypes.Serializable<VoidReason> & {
    MissingPrint: damlTypes.Serializable<VoidReason.MissingPrint>;
    QuorumNotMet: damlTypes.Serializable<VoidReason.QuorumNotMet>;
    ResolverAbsent: damlTypes.Serializable<VoidReason.ResolverAbsent>;
    SourceDisagreement: damlTypes.Serializable<VoidReason.SourceDisagreement>;
  }

export namespace VoidReason {
  type MissingPrint = {
    slot: Slot,
  }
  type QuorumNotMet = {
    slot: Slot,
  }
  type ResolverAbsent = {
    slot: Slot,
  }
  type SourceDisagreement = {
    slot: Slot,
  }
}
