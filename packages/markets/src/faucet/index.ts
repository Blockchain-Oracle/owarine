/**
 * The faucet's server side. On Canton demo cash is credited into `VenueCash` server-side (C4) and there is no SOL leg;
 * until then the chain half refuses honestly. The role-key lookup (`keys.ts`) is unchanged. Browser code never imports
 * this module.
 */
export { createFaucetChain, type FaucetChain, type FaucetKeys, type FaucetMint, type PreparedFaucetTransaction } from "./chain";
export { FAUCET_ROLE_ENV, faucetRoleSecret, type FaucetRole } from "./keys";
