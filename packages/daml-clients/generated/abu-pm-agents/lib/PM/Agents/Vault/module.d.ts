// Generated from ../../../PM/Agents/Vault/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c from '@daml.js/abu-pm-main-0.5.0';
import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@daml.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type GrantDesk = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
}

export declare interface GrantDeskInterface {
  Archive: 
    damlTypes.Choice<GrantDesk, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GrantDesk, undefined>>;
  GrantDesk_Fund: 
    damlTypes.Choice<GrantDesk, GrantDesk_Fund, damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.AgentGrant>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GrantDesk, undefined>>;
  GrantDesk_Open: 
    damlTypes.Choice<GrantDesk, GrantDesk_Open, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.AgentGrant>, damlTypes.Optional<damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GrantDesk, undefined>>;
}
export declare const GrantDesk:
  damlTypes.Template<GrantDesk, undefined, '#abu-pm-agents:PM.Agents.Vault:GrantDesk'> &
  damlTypes.ToInterface<GrantDesk, never> &
  GrantDeskInterface

export declare type GrantDesk_Fund = {
  grantCid: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.AgentGrant>,
  cash: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>[],
}

export declare const GrantDesk_Fund:
  damlTypes.Serializable<GrantDesk_Fund>

export declare type GrantDesk_Open = {
  agent: damlTypes.Party,
  caps: pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Grant.GrantCaps,
  expiresAt: damlTypes.Time,
  dayZero: damlTypes.Time,
  budget: damlTypes.Int,
  cash: damlTypes.ContractId<pkg076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c.PM.Money.VenueCash>[],
}

export declare const GrantDesk_Open:
  damlTypes.Serializable<GrantDesk_Open>
