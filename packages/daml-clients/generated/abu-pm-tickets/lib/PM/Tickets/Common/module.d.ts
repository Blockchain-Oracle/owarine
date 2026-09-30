// Generated from ../../../PM/Tickets/Common/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c from '@daml.js/abu-pm-main-0.5.0';

export declare type Paid = {
  toOwner: damlTypes.Optional<damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>>,
  toReserve: damlTypes.Optional<damlTypes.ContractId<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Money.VenueCash>>,
}

export declare const Paid:
  damlTypes.Serializable<Paid>

export declare type TicketReceipt = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  product: string,
  marketId: string,
  pairId: string,
  outcome: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side,
  resolved: damlTypes.Optional<pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Types.Side>,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  cost: damlTypes.Int,
  payout: damlTypes.Int,
  fee: damlTypes.Int,
  detail: pkgad2b593b3dcf7ab5d711aad5834395b5887e1c48253e0f6b028f699cd844404c.PM.Publication.ReceiptDetail,
}

export declare const TicketReceipt:
  damlTypes.Serializable<TicketReceipt>
