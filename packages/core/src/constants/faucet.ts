/** The venue's per-call cap on the tUSDC faucet, in whole units. */
export const FAUCET_UNITS = 100_000n;

/**
 * External fee faucets, in preference order. The reference listed the Solana devnet faucet; Canton charges a seat no
 * network fee, so there is none to list (the name stays for the shared `GasRouting` shape).
 */
export const SOL_FAUCETS: readonly { name: string; url: string }[] = [];
