import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readSecretKey } from "../actors/secret-key";

/** The S3 venue roles (scripts/deploy/roles.mjs); `desk-runner` is the desk's operator (S21). */
export type OpsRole = "roller" | "price-relay" | "price-attestor" | "settler" | "maker" | "faucet-mint-authority" | "desk-runner";

/** `price-relay` → `PRICE_RELAY_PRIVATE_KEY`. */
export const roleEnvName = (role: OpsRole) => `${role.replaceAll("-", "_").toUpperCase()}_PRIVATE_KEY`;

/**
 * A role's 64-byte keypair: the `<ROLE>_PRIVATE_KEY` env var (Fly), else `~/.config/agari/devnet/<role>.json`
 * (`AGARI_KEYS_DIR` overrides the directory). Null means scan-and-report: never a guessed or shared signer.
 * Off-ledger signatures only (the desk and the legacy actors); on Canton a role acts as a party, see `roleParty`.
 */
export function roleSecret(role: OpsRole, env: NodeJS.ProcessEnv = process.env): Uint8Array | null {
  const fromEnv = readSecretKey(env[roleEnvName(role)]);
  if (fromEnv) return fromEnv;
  const file = join(env.AGARI_KEYS_DIR ?? join(homedir(), ".config", "agari", "devnet"), `${role}.json`);
  return existsSync(file) ? readSecretKey(readFileSync(file, "utf8")) : null;
}

// ---- Canton: role parties ----------------------------------------------------------------------

/** The infrastructure parties (plan §4 budget): venue, resolver, three oracles, auditor, liquidity provider, agent runner. */
export const CANTON_ROLES = ["venue", "resolver", "oracle-coinbase", "oracle-kraken", "oracle-bitstamp", "auditor", "lp", "agent-runner"] as const;
export type CantonRole = (typeof CANTON_ROLES)[number];
export type OracleRole = Extract<CantonRole, `oracle-${string}`>;
export const ORACLE_ROLES: readonly OracleRole[] = ["oracle-coinbase", "oracle-kraken", "oracle-bitstamp"];

/** `oracle-coinbase` → `ORACLE_COINBASE_PARTY`. */
export const rolePartyEnvName = (role: CantonRole) => `${role.replaceAll("-", "_").toUpperCase()}_PARTY`;

/** What the bootstrap writes (`scripts/bootstrap-local.ts`) and ops reads: party ids by role, plus the network they live on. */
export interface PartiesFile {
  network: string;
  createdAtMs: number;
  parties: Partial<Record<CantonRole, string>>;
  /** Extra non-infrastructure parties a drive run allocated (demo users), by name. */
  users?: Record<string, string>;
  /** The price-policy version the bootstrap's Series use: the feeders stamp it on every `PriceQuote`. */
  policyVersion?: number;
}

/** `AGARI_PARTIES_FILE`, else `~/.config/agari/canton/parties.json` (beside the role keys, never in the repo). */
export const partiesFilePath = (env: NodeJS.ProcessEnv = process.env) => env.AGARI_PARTIES_FILE || join(homedir(), ".config", "agari", "canton", "parties.json");

export function readPartiesFile(env: NodeJS.ProcessEnv = process.env): PartiesFile | null {
  const path = partiesFilePath(env);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as PartiesFile;
  return parsed && typeof parsed === "object" && parsed.parties ? parsed : null;
}

/** A Canton party id: `<hint>::<fingerprint>`. */
const PARTY_ID = /^[A-Za-z0-9_\-:]{1,255}::[0-9a-f]{8,}$/;

/**
 * A role's party: `<ROLE>_PARTY` (e.g. `VENUE_PARTY`), else the bootstrap's parties file. Null means scan-and-report:
 * the actor reads and logs what it would do, and never guesses or shares another role's party.
 */
export function roleParty(role: CantonRole, env: NodeJS.ProcessEnv = process.env, file: PartiesFile | null = readPartiesFile(env)): string | null {
  const fromEnv = env[rolePartyEnvName(role)]?.trim();
  if (fromEnv) return PARTY_ID.test(fromEnv) ? fromEnv : null;
  const fromFile = file?.parties[role];
  return fromFile && PARTY_ID.test(fromFile) ? fromFile : null;
}
