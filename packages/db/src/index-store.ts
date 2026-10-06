/** Projection store (schema-index.ts): the venue party's ledger view in Postgres. Owned by C3a. */
export { applyFacts } from "./idx/apply";
export { marketIdOfKey, seriesIdOfKey } from "./idx/ids";
export { indexReader, type IdxFillQuery, type IdxSeatLease, type IdxMarketQuery, type IdxRow, type IndexReader } from "./idx/read";
export type { IdxAttestationEvidence, IdxCursor, IdxEvidence, IdxFact, IdxPolicyVersion, IdxRawEvent, IdxReceiptDetail, IdxUpdate } from "./idx/types";
export { indexWriter, offsetOf, type ApplyResult, type IndexWriter } from "./idx/write";
export { resolutionsByMarket, type ProjectedResolution } from "./idx/read-resolutions";
export { projectedLiveSets, projectionInvariants, VERIFIED_TEMPLATES, type VerifiedTemplate } from "./idx/read-verify";
export { tapeActions, tapeFills, tapeMarkets, tapeTickets, type TapeMarketsQuery, type TapeRangeQuery } from "./idx/read-tape";
export { proofArchives, proofPrints, proofWindow, type ProofArchiveRow, type ProofPrintRow, type ProofWindowRow } from "./idx/read-proof";
export { publishedOn } from "./idx/read-publications";
export { publishedFills, publishedReceipts } from "./idx/read-published";
// C8d (C-DAML-03): product dependents, counted in the projection.
export { openDependentSpans, openDependents, quoteIsCited, type DependentSpan } from "./idx/read-dependents";
export { venueStats, type VenueStatsRow } from "./idx/read-venue-stats";
export { latestRecount, recordRecount, type RecountRow } from "./audit";
export { cursorHead, oracleFreshness, pipelineBacklog, type BacklogRow, type CursorHeadRow, type OracleFreshRow } from "./idx/read-status-canton";
export { statusReader, type CrossCheckRow, type PrintMixRow, type StatusReader } from "./idx/read-status";
export {
  crowdFlow,
  socialActivityReader,
  type CrowdFlowRow,
  type SocialActivityQuery,
  type SocialActivityReader,
  type SocialFillRow,
  type SocialSettlementRow,
} from "./idx/social-activity";
export { seatActivityReader, type SeatActivityReader } from "./idx/seat-activity";
export { INDEX_TABLES, K_ANON_FLOOR } from "./schema-index";
