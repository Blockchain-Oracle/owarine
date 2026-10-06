// Generated from ../../../PM/Tickets/Common/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a from '@daml.js/abu-pm-main-0.5.2';

export declare type Paid = {
  toOwner: damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>,
  toReserve: damlTypes.Optional<damlTypes.ContractId<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Money.VenueCash>>,
}

export declare const Paid:
  damlTypes.Serializable<Paid>

export declare type TicketReceipt = {
  venue: damlTypes.Party,
  owner: damlTypes.Party,
  product: string,
  marketId: string,
  pairId: string,
  outcome: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side,
  resolved: damlTypes.Optional<pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Types.Side>,
  lots: damlTypes.Int,
  cashUnit: damlTypes.Int,
  backingShare: damlTypes.Int,
  cost: damlTypes.Int,
  payout: damlTypes.Int,
  fee: damlTypes.Int,
  detail: pkgf29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a.PM.Publication.ReceiptDetail,
}

export declare const TicketReceipt:
  damlTypes.Serializable<TicketReceipt>
