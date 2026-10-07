/**
 * The Canton Coin rail's configuration (C7b). Everything is optional except that the rail does nothing without a
 * venue party and an auditor party; the registry URL and the instrument's admin party are what DevNet or MainNet adds.
 * The rate is a stated venue parameter (K-245), fixed per listing: changing `CC_UNITS_PER_COIN` under an existing
 * `CC_LISTING_ID` changes nothing on the ledger (the listing is immutable); a new rate is a new listing id.
 */
import { ccRateOk } from "@owarine/ledger/pure";

export interface CcRailEnv {
  listingId: string;
  /** The instrument's admin party (Canton Coin: the DSO party), required to create a listing. */
  instrumentAdmin: string | null;
  instrumentId: string;
  unitsPerCoin: bigint;
  minDepositUnits: bigint;
  maxDepositUnits: bigint;
  /** The token registry's base URL; null = none, so nothing that needs a factory or a context is attempted. */
  registryUrl: string | null;
  /** Package ids the registry's instruction templates may come from; empty = any signed by the admin. */
  allowedPackageIds: string[];
  everyMs: number;
  refundAfterSec: number;
  transferWindowSec: number;
  attestEverySec: number;
  /** Create the listing when absent. Off by default: a listing is a stated offer, and Abu states it. */
  createListing: boolean;
  /** Fail closed on K-224: credit and pay only seats with a live lease. Off only for a LocalNet with no seat pool. */
  requireLease: boolean;
}

const bigint = (v: string | undefined, fallback: bigint, what: string): bigint => {
  if (v === undefined || v === "") return fallback;
  if (!/^\d+$/.test(v)) throw new Error(`${what} must be a non-negative integer, got ${JSON.stringify(v)}`);
  return BigInt(v);
};
const int = (v: string | undefined, fallback: number, what: string, min = 0): number => {
  const n = v === undefined || v === "" ? fallback : Number(v);
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`${what} must be an integer of at least ${min}, got ${JSON.stringify(v)}`);
  return n;
};

export function readCcRailEnv(env: NodeJS.ProcessEnv = process.env): CcRailEnv {
  const unitsPerCoin = bigint(env.CC_UNITS_PER_COIN, 100_000n, "CC_UNITS_PER_COIN");
  if (!ccRateOk(unitsPerCoin)) throw new Error(`CC_UNITS_PER_COIN ${unitsPerCoin} must divide 10^10 (one cash unit is a whole number of atomic units)`);
  const minDepositUnits = bigint(env.CC_MIN_DEPOSIT_UNITS, 100_000n, "CC_MIN_DEPOSIT_UNITS");
  const maxDepositUnits = bigint(env.CC_MAX_DEPOSIT_UNITS, 1_000_000_000n, "CC_MAX_DEPOSIT_UNITS");
  if (minDepositUnits <= 0n || minDepositUnits > maxDepositUnits) throw new Error("CC_MIN_DEPOSIT_UNITS must be positive and at most CC_MAX_DEPOSIT_UNITS");
  return {
    listingId: env.CC_LISTING_ID || "cc-1",
    instrumentAdmin: env.CC_INSTRUMENT_ADMIN || null,
    instrumentId: env.CC_INSTRUMENT_ID || "Amulet",
    unitsPerCoin,
    minDepositUnits,
    maxDepositUnits,
    registryUrl: env.CC_REGISTRY_URL || null,
    allowedPackageIds: (env.CC_ALLOWED_PACKAGE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    everyMs: int(env.CC_RAIL_EVERY_MS, 15_000, "CC_RAIL_EVERY_MS", 1_000),
    // A transfer the venue instructed is taken back only after the owner has had time to accept it: at least ten minutes.
    refundAfterSec: int(env.CC_REFUND_AFTER_SEC, 86_400, "CC_REFUND_AFTER_SEC", 600),
    transferWindowSec: int(env.CC_TRANSFER_WINDOW_SEC, 86_400, "CC_TRANSFER_WINDOW_SEC", 600),
    attestEverySec: int(env.CC_ATTEST_EVERY_SEC, 300, "CC_ATTEST_EVERY_SEC"),
    createListing: env.CC_CREATE_LISTING === "1",
    requireLease: env.CC_REQUIRE_LEASE !== "0",
  };
}
