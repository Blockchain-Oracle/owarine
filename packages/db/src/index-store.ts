/** Projection store (schema-index.ts): the venue party's ledger view in Postgres. Owned by C3a. */
export { applyFacts } from "./idx/apply";
export { marketIdOfKey, seriesIdOfKey } from "./idx/ids";
export { indexReader, type IdxFillQuery, type IdxMarketQuery, type IdxRow, type IndexReader } from "./idx/read";
export type { IdxCursor, IdxEvidence, IdxFact, IdxPolicyVersion, IdxRawEvent, IdxUpdate } from "./idx/types";
export { indexWriter, offsetOf, type ApplyResult, type IndexWriter } from "./idx/write";
export { resolutionsByMarket, type ProjectedResolution } from "./idx/read-resolutions";
export { projectedLiveSets, projectionInvariants, VERIFIED_TEMPLATES, type VerifiedTemplate } from "./idx/read-verify";
export { tapeActions, tapeFills, tapeMarkets, type TapeMarketsQuery, type TapeRangeQuery } from "./idx/read-tape";
export { proofArchives, proofPrints, proofWindow, type ProofArchiveRow, type ProofPrintRow, type ProofWindowRow } from "./idx/read-proof";
export { publishedOn } from "./idx/read-publications";
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
export { INDEX_TABLES, K_ANON_FLOOR } from "./schema-index";
