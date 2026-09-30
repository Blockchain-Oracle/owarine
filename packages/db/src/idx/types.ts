/**
 * Structural rows the projector hands the store. The store never imports the ledger client or the Daml bindings:
 * `services/ops` decodes each `/v2/updates` transaction into these facts, and `idx/apply.ts` turns them into rows.
 * Integers the ledger sends as strings stay decimal strings; instants are unix seconds.
 */

export type Side = 0 | 1; // 0 Up (YES), 1 Down (NO)

/** One raw event as the venue witnessed it (`idx_events`). */
export interface IdxRawEvent {
  nodeId: number;
  kind: "created" | "exercised" | "archived";
  /** `Module:Entity`, the package id stripped. */
  template: string;
  packageName: string | null;
  contractId: string;
  choice: string | null;
  consuming: boolean | null;
  lastDescendant: number | null;
  /** The Daml `marketId` text the event names, when it names one. */
  marketKey: string | null;
  data: unknown;
}

export interface IdxEvidence {
  oracle: string;
  priceE8: string;
  fetchedAtSec: number;
  payloadHash: string;
  quoteCid: string;
}

export interface IdxPolicyVersion {
  version: number;
  effectiveFromSec: number;
  validUntilSec: number | null;
  printSource: string;
  minDelaySec: number;
  barLenSec: number;
  openAdmissionSec: number;
  closeAdmissionSec: number;
}

export type IdxFact =
  | {
      kind: "series";
      contractId: string;
      seriesKey: string;
      symbol: string;
      cadenceSec: number;
      cashUnit: string;
      nextIndex: number;
      anchorSec: number;
      lockLeadSec: number;
      settleGraceSec: number;
      quorum: number;
      oracles: string[];
      maxDeviationBps: number;
      resolver: string;
      policyVersions: IdxPolicyVersion[];
    }
  | {
      kind: "window-opened";
      termsCid: string;
      marketKey: string;
      seriesKey: string;
      index: number;
      symbol: string;
      cashUnit: string;
      tradingStartSec: number;
      lockAtSec: number;
      expirySec: number;
      openDeadlineSec: number;
      closeDeadlineSec: number;
      refundAfterSec: number;
      policyVersion: number;
      printSource: string;
      minDelaySec: number;
      barLenSec: number;
      tieUp: boolean;
      quorum: number;
      oracles: string[];
      maxDeviationBps: number;
      resolver: string;
    }
  | { kind: "window-state"; contractId: string; termsCid: string; live: boolean }
  | { kind: "open-print"; contractId: string; termsCid: string; openPriceE8: string; signers: number; evidence: IdxEvidence[] }
  | { kind: "open-print-consumed"; contractId: string }
  | {
      kind: "resolution";
      contractId: string;
      termsCid: string;
      outcome: Side | null;
      /** e.g. `SourceDisagreement:CloseSlot`; null when resolved. */
      voidDetail: string | null;
      openPriceE8: string | null;
      closePriceE8: string | null;
      openEvidence: IdxEvidence[];
      closeEvidence: IdxEvidence[];
      signers: number;
      /** The created event's own time and disclosure fields (blob null unless the stream asked for blobs). */
      createdAtMs: number;
      templateId: string;
      createdEventBlob: string | null;
      synchronizerId: string | null;
    }
  | {
      kind: "price";
      contractId: string;
      oracle: string;
      symbol: string;
      boundarySec: number;
      priceE8: string;
      barStartSec: number;
      barLenSec: number;
      fetchedAtSec: number;
      payloadHash: string;
      policyVersion: number;
    }
  | { kind: "price-retired"; contractId: string }
  | {
      kind: "quote";
      quoteKind: "quote" | "buy";
      contractId: string;
      user: string;
      termsCid: string;
      /** Quote carries the Daml marketId; BuyQuote does not, so the store finds its Window by terms. */
      marketKey: string | null;
      pairId: string;
      side: Side;
      priceTicks: number;
      lots: string;
      cashUnit: string;
      fee: string;
      legCid: string | null;
      validUntilSec: number;
    }
  | { kind: "quote-closed"; contractId: string; how: "accepted" | "expired" | "withdrawn" }
  | {
      kind: "leg";
      nodeId: number;
      contractId: string;
      owner: string;
      venue: string;
      termsCid: string;
      marketKey: string;
      pairId: string;
      outcome: Side;
      lots: string;
      cashUnit: string;
      backingShare: string;
      feePaid: string;
      refundAfterSec: number;
      origin: "accept" | "buyback" | "closeout" | "snapshot" | "other";
      /** For `accept`: the Quote_Accept (or, when `resting`, the Rest_Fill) exercise (its node keys the fill) and the quote (or call). */
      acceptNodeId: number | null;
      quoteCid: string | null;
      /** 0.5.1: the leg came from a resting call's fill: an ordinary accept-origin position, and the seat's activity says so. */
      resting?: boolean;
    }
  | {
      /**
       * 0.5.1: a resting call now exists or changed. `placed`: created by `RestOffer_Place` (a new row); otherwise the
       * remainder a partial fill re-created (the row keeps its `callRef`, takes the new contract id and lots).
       */
      kind: "rest-call";
      contractId: string;
      callRef: string;
      user: string;
      termsCid: string;
      marketKey: string;
      side: Side;
      priceTicks: number;
      lotsPlaced: string;
      lots: string;
      cashUnit: string;
      escrow: string;
      tradingStartSec: number;
      expiresAtSec: number;
      placed: boolean;
    }
  | {
      /** 0.5.1: a resting call's contract ended: filled completely, cancelled by its owner, or expired unfilled (`refundedBase` back). */
      kind: "rest-closed";
      contractId: string;
      how: "filled" | "cancelled" | "expired";
      refundedBase: string;
    }
  | {
      /** A user's leg sold back through BuyQuote_Accept: one SELL fill, keyed by that exercise's node. */
      kind: "sale";
      nodeId: number;
      buyQuoteCid: string;
      legCid: string;
      priceTicks: number;
      saleBase: string;
      /** Lots sold (the venue's slice); absent on a pre-0.3.0 whole-leg sale, which sold the leg's lots. */
      lots?: string;
    }
  | {
      kind: "leg-closed";
      contractId: string;
      how: "settled" | "claimed" | "refunded_stale" | "sold" | "closed_out" | "merged" | "archived";
      /** Venue cash created for the leg's owner by this exit (payout, refund, sale or close-out). */
      paidBase: string;
      /** Venue cash created for the venue as recognised fee. */
      feeBase: string;
      resolutionCid: string | null;
    }
  | {
      kind: "publication";
      contractId: string;
      owner: string;
      handle: string;
      marketKey: string;
      pairId: string;
      outcome: Side;
      lots: string;
      backingShare: string;
      /** 0.4.0: null = a pair leg; the ticket product otherwise. */
      product: string | null;
    }
  | { kind: "publication-archived"; contractId: string }
  // 0.4.0 (C6d): committee events.
  | { kind: "event-terms"; contractId: string; termsCid: string; question: string; attestors: string[]; quorum: number }
  | { kind: "event-state"; contractId: string; termsCid: string; live: boolean }
  | { kind: "event-attestation"; contractId: string; marketKey: string; attestor: string; answer: boolean; attestedAtSec: number; statementHash: string }
  | { kind: "event-attestation-retired"; contractId: string }
  | { kind: "event-verdict"; contractId: string; termsCid: string; answer: boolean | null; voidDetail: string | null; attestations: IdxAttestationEvidence[] }
  | {
      kind: "receipt";
      contractId: string;
      owner: string;
      marketKey: string;
      pairId: string;
      outcome: Side;
      resolved: Side | null;
      lots: string;
      cashUnit: string;
      backingShare: string;
      cost: string;
      payout: string;
      fee: string;
      product: string | null;
      detail: IdxReceiptDetail | null;
    }
  | { kind: "receipt-dismissed"; contractId: string };

export interface IdxAttestationEvidence {
  attestor: string;
  answer: boolean;
  attestedAtSec: number;
  statementHash: string;
  attestationCid: string;
}

/** A ticket's settlement beyond the pair-leg fields (`PM.Publication.ReceiptDetail`), amounts as decimal strings. */
export interface IdxReceiptDetail {
  reserveId: string;
  marketIds: string[];
  pick: string;
  stake: string;
  toReserve: string;
  result: "won" | "lost" | "void" | string;
}

/** One decoded transaction (or the ACS bootstrap, whose update id is `acs:<offset>`). */
export interface IdxUpdate {
  updateId: string;
  offset: number;
  recordTimeMs: number | null;
  effectiveAtMs: number;
  commandId: string | null;
  workflowId: string | null;
  events: IdxRawEvent[];
  facts: IdxFact[];
}

export interface IdxCursor {
  stream: string;
  party: string;
  offset: number;
  updateId: string | null;
  bootstrap: "replay" | "acs";
  historyFromOffset: number;
}
