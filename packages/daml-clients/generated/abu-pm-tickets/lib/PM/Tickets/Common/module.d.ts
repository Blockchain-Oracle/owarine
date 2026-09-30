// Generated from ../../../PM/Tickets/Common/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 from '@daml.js/abu-pm-main-0.5.1';

export declare type Paid = {
  toOwner: damlTypes.Optional<damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>>,
  toReserve: damlTypes.Optional<damlTypes.ContractId<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Money.VenueCash>>,
}

export declare const Paid:
  damlTypes.Serializable<Paid>

export declare type TicketReceipt = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  product: string,
  marketId: string,
  pairId: string,
  outcome: pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Types.Side,
  resolved: damlTypes.Optional<pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Types.Side>,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  cost: damlTypes.Int,
  payout: damlTypes.Int,
  fee: damlTypes.Int,
  detail: pkg27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580.PM.Publication.ReceiptDetail,
}

export declare const TicketReceipt:
  damlTypes.Serializable<TicketReceipt>
