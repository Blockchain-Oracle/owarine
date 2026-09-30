// Generated from ../../../PM/Tickets/Common/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550 from '@daml.js/abu-pm-main-0.5.0';

export declare type Paid = {
  toOwner: damlTypes.Optional<damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>>,
  toReserve: damlTypes.Optional<damlTypes.ContractId<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Money.VenueCash>>,
}

export declare const Paid:
  damlTypes.Serializable<Paid>

export declare type TicketReceipt = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  product: string,
  marketId: string,
  pairId: string,
  outcome: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Types.Side,
  resolved: damlTypes.Optional<pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Types.Side>,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  cost: damlTypes.Int,
  payout: damlTypes.Int,
  fee: damlTypes.Int,
  detail: pkgceeb21a38b4773094ffae7f86c65d5c4a4580f73f2a42939e9f89fa4f851d550.PM.Publication.ReceiptDetail,
}

export declare const TicketReceipt:
  damlTypes.Serializable<TicketReceipt>
