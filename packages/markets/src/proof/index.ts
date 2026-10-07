/**
 * `@owarine/markets/proof`: the proof replay's surface. On Canton an archived price is re-verified from its payload and
 * the `PriceQuote` contract's `payloadHash` (C5); until then every replay is refused. Server-only; not re-exported from
 * the root, and a route imports it lazily.
 */
export { balanceLamports } from "./chain";
export { closeProofAccounts, PROOF_KEEP_SEC, type CloseReport } from "./close";
export { decodePriceUpdateV2, printDiff, PRICE_UPDATE_V2_DISCRIMINATOR, type PriceUpdateV2, type PriceUpdateVerification } from "./decode";
export { parseArchivedUpdate, preflightRefusal, type ArchivedUpdate, type HermesFeed, type PreflightRefusal } from "./hermes";
export { PROOF_REPLAY_KEY_ENV, PROOF_REPLAY_ROLE, proofReplayRpcUrl, proofReplaySecret } from "./keys";
export {
  POSTING_STALE_MS,
  postPreparedReplay,
  prepareReplay,
  PYTH_SOURCE,
  pythFeedOf,
  redactError,
  replayPythProof,
  symbolOfPythFeed,
  type PreparedReplay,
  type ReplayDeps,
  type ReplayOutcome,
  type ReplayRefusal,
} from "./replay";
export type { OpenProof, ProofClaim, ProofState, ProofStore, StoredPrint, VerifiedProofRow } from "./store";
export { keypairAddress } from "../sessions/keypair";
