import type { IntentJournal } from "@owarine/core/ports";
import type { Address } from "@owarine/core/types";
import type { MarketsEnv } from "../env";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import type { WriteRpc } from "../submitter/write-rpc";
import type { SponsorCosigner } from "../vault";
import type { WebCryptoKeyPair } from "./ed25519";
import type { SubmitterSession } from "./submitter-session";

/**
 * The reference's tap-trading session key (D-066). On Canton it is not needed: a seat already trades in one tap, so
 * nothing needs a second key under a vault grant (plan "Allowed deviations"). The names stay so the web's session
 * surfaces compile and say so honestly; generating or opening one refuses with the not-deployed reason.
 */
export interface SessionKey {
  address: Address;
  /** WebCrypto's `CryptoKeyPair`. */
  keyPair: WebCryptoKeyPair;
}

const NOT_NEEDED = cantonNotLive("session keys (a seat already trades in one tap)");

export async function generateSessionKey(): Promise<SessionKey> {
  throw notDeployedError(NOT_NEEDED);
}

export interface SessionKeySessionConfig {
  env: MarketsEnv;
  keyPair: SessionKey["keyPair"];
  journal: IntentJournal;
  nowMs?: () => number;
  sponsor?: SponsorCosigner;
  rpc?: WriteRpc;
}

export async function createSessionKeySession(_config: SessionKeySessionConfig): Promise<SubmitterSession> {
  throw notDeployedError(NOT_NEEDED);
}
