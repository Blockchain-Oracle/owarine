/** The payer-balance read the replay route checks first. There is no fee payer on Canton; it rejects with the not-live reason. */
import { notDeployedError, cantonNotLive } from "../stub/not-deployed";

export async function balanceLamports(_rpcUrl: string, _owner: string): Promise<bigint> {
  throw notDeployedError(cantonNotLive("proof"));
}
