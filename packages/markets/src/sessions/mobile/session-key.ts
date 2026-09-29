import type { SessionKey } from "../session-key";
import { cantonNotLive, notDeployedError } from "../../stub/not-deployed";

/** The reference's tap-trading key seed on a phone: kept for its call site. */
export const SESSION_KEY_SEED_BYTES = 32;

const NOT_NEEDED = cantonNotLive("session keys (a seat already trades in one tap)");

/** Not needed on Canton: the seat already trades in one tap (plan "Allowed deviations"). Refuses honestly. */
export async function sessionKeyFromSeed(_seed: Uint8Array): Promise<SessionKey> {
  throw notDeployedError(NOT_NEEDED);
}

export async function newSessionKeySeed(): Promise<{ seed: Uint8Array; key: SessionKey }> {
  throw notDeployedError(NOT_NEEDED);
}
