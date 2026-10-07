/**
 * The registry client a deployment configures (C7b; revamp 2b), shared by the web seat tier and the ops rail so both ask
 * the same endpoint the same way:
 *   CC_REGISTRY_URL    the registry's base; a validator's scan proxy is `<validator>/api/validator/v0/scan-proxy`
 *   CC_REGISTRY_AUTH   `ledger`: send this process's own ledger token (a scan proxy asks for it); unset: no credential
 *   CC_FAUCET_COIN     DevNet only: the test coin one tap gives a seat (`AmuletRules_DevNet_Tap` through the same scan
 *                      proxy); unset everywhere else. A seat holding that much already cannot tap again.
 */
import { ccToAtomic, parseLedgerEnv, tokenSourceFromEnv } from "@owarine/ledger";
import { readTapContext, type TapContext } from "./devnet-tap";
import { createRegistryClient, type RegistryClient } from "./registry";

type Env = Record<string, string | undefined>;

function tokenOf(env: Env): (() => Promise<string | undefined>) | null {
  if (env.CC_REGISTRY_AUTH && env.CC_REGISTRY_AUTH !== "ledger") throw new Error(`CC_REGISTRY_AUTH must be "ledger" or unset, got ${JSON.stringify(env.CC_REGISTRY_AUTH)}`);
  if (env.CC_REGISTRY_AUTH !== "ledger") return null;
  const source = tokenSourceFromEnv(parseLedgerEnv(env));
  return () => source.token();
}

export function registryFromEnv(env: Env = process.env): RegistryClient | null {
  if (!env.CC_REGISTRY_URL) return null;
  const token = tokenOf(env);
  return createRegistryClient({ baseUrl: env.CC_REGISTRY_URL, ...(token ? { token } : {}) });
}

/** The DevNet faucet a seat taps (`server/cc.ts` `CcFaucet`), or null when `CC_FAUCET_COIN` or the scan proxy is not set. */
export function faucetFromEnv(env: Env = process.env): { amount: string; capAtomic: bigint; context: () => Promise<TapContext> } | null {
  const amount = env.CC_FAUCET_COIN;
  if (!amount || !env.CC_REGISTRY_URL) return null;
  const capAtomic = ccToAtomic(amount);
  if (capAtomic <= 0n) throw new Error(`CC_FAUCET_COIN must be a positive amount, got ${JSON.stringify(amount)}`);
  const scanProxyUrl = env.CC_REGISTRY_URL;
  const token = tokenOf(env) ?? (async () => undefined);
  return { amount, capAtomic, context: () => readTapContext({ scanProxyUrl, token }) };
}
