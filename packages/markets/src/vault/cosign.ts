import type { Address, Signature } from "@owarine/core/types";

/**
 * Fee sponsorship. Canton charges the user no per-transaction fee (the venue's participant pays traffic), so there is
 * nothing to co-sign: the shapes stay for the session and sponsor-transport callers, and every cosigner reports no
 * sponsor and refuses a co-sign by saying so.
 */
export type CosignResult = { ok: true; transaction: string; signature: Signature } | { ok: false; reason: string };

export interface SponsorCosigner {
  /** The fee payer to build with; null = none (always, on Canton). */
  sponsor(): Promise<Address | null>;
  /** A co-sign request; refused, because no network fee exists to pay. */
  cosign(request: { transaction: string; lastValidBlockHeight: bigint }): Promise<CosignResult>;
}

export const NO_NETWORK_FEE = "Canton charges no network fee for this write: there is nothing to sponsor";

/** A cosigner for a local fee payer. The key is not used: there is no fee to pay. */
export function localCosigner(_feePayer: unknown): SponsorCosigner {
  return {
    async sponsor() {
      return null;
    },
    async cosign() {
      return { ok: false, reason: NO_NETWORK_FEE };
    },
  };
}
