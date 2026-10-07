/**
 * The sponsor as the route sees it: `status()` and `cosign()`. Canton charges the user no network fee (the venue's
 * participant pays traffic), so the machinery is gone and the path is kept: status truthfully reports that no sponsor
 * is needed, and a co-sign request is refused. `sponsorLimitsFrom` and `sponsorRoleSecret` stay because the games'
 * gates read the same env. Server-only.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { COMPUTE_UNIT_LIMIT_MAX } from "@owarine/core/constants";
import type { Address } from "@owarine/core/types";
import { parseSecretKey } from "../sessions/keypair";
import { cantonNotLive } from "../stub/not-deployed";
import type { AttemptLimits, GateLimits, SponsorLedger } from "./gates";
import { refuse, type Refusal, type StaticLimits } from "./policy";
import { NO_NETWORK_FEE, SPONSOR_ALLOWLIST, type SponsorStatus } from "./status";

type Env = Record<string, string | undefined>;

export const NO_SPONSOR_KEY = NO_NETWORK_FEE;

export interface SponsorLimits extends StaticLimits, GateLimits, AttemptLimits {
  maxFeeLamports: bigint;
}

/** What a co-sign would have returned; never produced on Canton. */
export interface CosignAccepted {
  ok: true;
  signature: string;
  transaction: string;
  instruction: string;
}

const count = (env: Env, name: string, fallback: number) => (env[name] && /^\d{1,9}$/.test(env[name]!) ? Number(env[name]) : fallback);
const lamports = (env: Env, name: string, fallback: bigint) => (env[name] && /^\d{1,19}$/.test(env[name]!) ? BigInt(env[name]!) : fallback);

/** The reference's limits, each overridable by its `SPONSOR_*` variable; the games' hourly gates still read them. */
export function sponsorLimitsFrom(env: Env): SponsorLimits {
  return {
    signerPerHour: count(env, "SPONSOR_PER_ADDRESS_PER_HOUR", 30),
    devicePerHour: count(env, "SPONSOR_PER_DEVICE_PER_HOUR", 60),
    deviceDailyLamports: lamports(env, "SPONSOR_DEVICE_DAILY_LAMPORTS", 5_000_000n),
    dailyLamports: lamports(env, "SPONSOR_DAILY_LAMPORTS", 500_000_000n),
    minBalanceLamports: lamports(env, "SPONSOR_MIN_BALANCE_LAMPORTS", 200_000_000n),
    maxFeeLamports: lamports(env, "SPONSOR_MAX_FEE_LAMPORTS", 10_000n),
    maxComputeUnits: Math.min(count(env, "SPONSOR_MAX_COMPUTE_UNITS", COMPUTE_UNIT_LIMIT_MAX), COMPUTE_UNIT_LIMIT_MAX),
    maxMicroLamports: lamports(env, "SPONSOR_MAX_MICRO_LAMPORTS", 0n),
    attemptsPerDevicePerMinute: count(env, "SPONSOR_ATTEMPTS_PER_DEVICE_PER_MINUTE", 20),
    attemptsPerIpPerMinute: count(env, "SPONSOR_ATTEMPTS_PER_IP_PER_MINUTE", 60),
  };
}

/** The role's 64-byte keypair: `SPONSOR_PRIVATE_KEY`, else the role file. Null when neither parses. */
export function sponsorRoleSecret(env: Env): Uint8Array | null {
  const read = (text: string | undefined) => {
    if (!text) return null;
    try {
      return parseSecretKey(text);
    } catch {
      return null;
    }
  };
  const fromEnv = read(env.SPONSOR_PRIVATE_KEY);
  if (fromEnv) return fromEnv;
  const file = join(env.OWARINE_KEYS_DIR || join(homedir(), ".config", "owarine", "devnet"), "sponsor.json");
  if (!existsSync(file)) return null;
  try {
    return read(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** The route's two calls; `vaultProgram` is kept in the signature for the route and ignored. */
export interface SponsorService {
  status(vaultProgram: Address | null): Promise<SponsorStatus>;
  cosign(vaultProgram: Address | null, body: unknown, device: string, ip: string): Promise<CosignAccepted | Refusal>;
}

/** No fee payer exists on Canton: status says so, and every co-sign is refused before anything is read. */
export function createSponsorService(_env: Env, _deps: { ledger?: SponsorLedger; nowMs?: () => number } = {}): SponsorService {
  return {
    async status() {
      return { configured: false, sponsor: null, balanceLamports: null, allowlist: SPONSOR_ALLOWLIST, reason: NO_NETWORK_FEE };
    },
    async cosign() {
      return refuse(503, cantonNotLive("sponsor"));
    },
  };
}

/** The games' fee-payer RPC. There is no fee payer on Canton; every call rejects with the not-live reason. */
export interface SponsorRpc {
  getBalance(address: Address): Promise<bigint>;
}

export function createSponsorRpc(_url: string): SponsorRpc {
  return {
    async getBalance() {
      throw new Error(cantonNotLive("sponsor"));
    },
  };
}
