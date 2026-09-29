/**
 * The client half of the reference's fee-payer co-sign (tap-trading.md §3). On Canton the seat pays no network fee (the
 * venue's participant pays traffic), so there is nothing to sponsor and nothing to fetch: the transport answers "no
 * sponsor" with the reason, locally, and refuses a co-sign by saying the same. The names stay for their call sites.
 */
import type { SponsorStatus } from "../sponsor/status";
import type { CosignResult, SponsorCosigner } from "../vault";

export interface SponsorTransportConfig {
  /** The route's path or absolute URL (`/api/sponsor` in the web); not called on Canton. */
  endpoint: string;
  /** This browser's id for the sponsor's per-device gate. */
  device: string;
  statusTtlMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface SponsorTransport extends SponsorCosigner {
  /** The last refusal the sponsor gave, for the sheet that wants to say why. */
  lastRefusal(): string | null;
  status(): Promise<SponsorStatus>;
}

const NO_NETWORK_FEE = "Canton charges the seat no network fee; there is nothing to sponsor";
const STATUS: SponsorStatus = { configured: false, sponsor: null, balanceLamports: null, allowlist: [], reason: NO_NETWORK_FEE };

export function createSponsorTransport(_config: SponsorTransportConfig): SponsorTransport {
  return {
    status: async () => STATUS,
    lastRefusal: () => NO_NETWORK_FEE,
    sponsor: async () => null,
    cosign: async (): Promise<CosignResult> => ({ ok: false, reason: NO_NETWORK_FEE }),
  };
}
