import type { Address } from "@owarine/core/types";

/**
 * The fee sponsor's status for `GET /api/sponsor`. On Canton the venue's participant pays the synchronizer traffic and
 * the user pays no network fee, so there is nothing to sponsor: `configured` is false, `reason` says why, and the
 * allowlist is empty. The shape is kept so the route and the session sheet keep rendering it. Browser-safe: only the
 * type is re-exported from the package root.
 */
export interface SponsorStatus {
  configured: boolean;
  sponsor: Address | null;
  /** The sponsor's balance for fees; null, because there is no fee payer on Canton. */
  balanceLamports: bigint | null;
  /** Sponsorable writes as `package:choice` names; empty on Canton. */
  allowlist: readonly string[];
  /** Why the sponsor is off: on Canton, that the user pays no network fee. */
  reason?: string;
}

/** Nothing is sponsorable: the user pays no network fee on Canton. */
export const SPONSOR_ALLOWLIST: readonly string[] = [];

/** The status line every sponsor read gives on Canton. */
export const NO_NETWORK_FEE = "Canton charges the user no network fee; there is nothing to sponsor";
