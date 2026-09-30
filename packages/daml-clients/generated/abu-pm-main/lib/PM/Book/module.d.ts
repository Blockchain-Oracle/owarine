// Generated from ../../PM/Book/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@daml.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as PM_Types from '../../PM/Types/module';

export declare type BookReceipt = {
  venue: damlTypes.Party,
  book: string,
  marketId: string,
  pairId: string,
  outcome: PM_Types.Side,
  resolved: damlTypes.Optional<PM_Types.Side>,
  kind: string,
  lots: damlTypes.Int,
  cost: damlTypes.Int,
  proceeds: damlTypes.Int,
}

export declare interface BookReceiptInterface {
  Archive: 
    damlTypes.Choice<BookReceipt, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BookReceipt, undefined>>;
  BookReceipt_Prune: 
    damlTypes.Choice<BookReceipt, BookReceipt_Prune, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BookReceipt, undefined>>;
}
export declare const BookReceipt:
  damlTypes.Template<BookReceipt, undefined, '#abu-pm-main:PM.Book:BookReceipt'> &
  damlTypes.ToInterface<BookReceipt, never> &
  BookReceiptInterface

export declare type BookReceipt_Prune = {
}

export declare const BookReceipt_Prune:
  damlTypes.Serializable<BookReceipt_Prune>
