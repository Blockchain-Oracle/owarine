// Generated from ../../../PM/Tickets/Common/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d from '@daml.js/abu-pm-main-0.4.0';

export declare type Paid = {
  toOwner: damlTypes.Optional<damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash>>,
  toReserve: damlTypes.Optional<damlTypes.ContractId<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Money.VenueCash>>,
}

export declare const Paid:
  damlTypes.Serializable<Paid>

export declare type TicketReceipt = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  product: string,
  marketId: string,
  pairId: string,
  outcome: pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Types.Side,
  resolved: damlTypes.Optional<pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Types.Side>,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  cost: damlTypes.Int,
  payout: damlTypes.Int,
  fee: damlTypes.Int,
  detail: pkg8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d.PM.Publication.ReceiptDetail,
}

export declare const TicketReceipt:
  damlTypes.Serializable<TicketReceipt>
