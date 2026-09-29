/**
 * `@agari/markets/holdings`: a seat's tokenised share holdings, read-only. Not live on Canton until C7b reads CIP-56
 * holdings; the read answers with `HoldingsReadError`. Server-only; not re-exported from the package root.
 */
export { HoldingsReadError, readHoldings, type Holding, type HoldingsBody, type HoldingsInput } from "./reader";
export { decimalToE12, effectiveMultiplierE12, exposureUsdE6, MULTIPLIER_SCALE, sharesE8, type ScaledUiAmountState } from "./scaled-amount";

/**
 * The reference's Helius mainnet URL builder, kept by name for `/api/holdings`. The key is a query parameter, so this
 * string is a secret. Nothing reads it on Canton (`readHoldings` is not live).
 */
export const heliusMainnetUrl = (apiKey: string): string => `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
