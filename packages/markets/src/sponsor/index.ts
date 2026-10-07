/**
 * `@owarine/markets/sponsor`: the fee sponsor's path, kept with its machinery removed. Canton charges the user no network
 * fee, so status reports that nothing needs sponsoring and co-signs are refused. Server-only; the root carries only
 * `SponsorStatus`.
 */
export {
  BREAKER_REASON,
  breakerOpen,
  createAttemptLimiter,
  createLocalLedger,
  gateVerdict,
  NO_DEVICE,
  type AttemptLimiter,
  type AttemptLimits,
  type CosignRow,
  type GateLimits,
  type SponsorLedger,
} from "./gates";
export { refuse, type Refusal, type StaticLimits } from "./policy";
export {
  createSponsorRpc,
  createSponsorService,
  NO_SPONSOR_KEY,
  sponsorLimitsFrom,
  sponsorRoleSecret,
  type CosignAccepted,
  type SponsorLimits,
  type SponsorRpc,
  type SponsorService,
} from "./service";
export { NO_NETWORK_FEE, SPONSOR_ALLOWLIST, type SponsorStatus } from "./status";
