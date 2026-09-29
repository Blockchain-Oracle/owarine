import type { Address, Signature } from "@agari/core/types";
import { notDeployedError } from "../stub/not-deployed";
import { ARENA_NOT_LIVE } from "./deployment";

/** The season admin's payout: one winner list, one amount each, paid once from the pool. */
export interface DistributeSeasonInput {
  /** The admin's signing key (a 64-byte seed ‖ public key); the Canton admin party replaces it in C9. */
  secretKey: Uint8Array;
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  seasonId: string;
  winners: readonly Address[];
  amountsBase: readonly bigint[];
}

/** A plain-promise write: rejects with the not-live reading until `SeasonPool` exists (C9). */
export async function distributeSeasonPrizes(_input: DistributeSeasonInput): Promise<Signature> {
  throw notDeployedError(ARENA_NOT_LIVE);
}
