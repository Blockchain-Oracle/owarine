// Generated from ../../../PM/Tickets/Common/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794 from '@daml.js/abu-pm-main-0.3.0';

export declare type Paid = {
  toOwner: damlTypes.Optional<damlTypes.ContractId<pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash>>,
  toReserve: damlTypes.Optional<damlTypes.ContractId<pkga494772c3dd3c2063da44055a410b7184976b2d0e5d818c554d1bde555443794.PM.Money.VenueCash>>,
}

export declare const Paid:
  damlTypes.Serializable<Paid>
