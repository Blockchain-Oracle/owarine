/**
 * `@agari/markets/holdings`: a seat's tokenised share holdings, read-only (C7b). Reads the party's CIP-56 `Holding`s from the
 * ledger (any registry's template, through the interface) and answers the ones a deployment maps to verified share tokens.
 * A failed read is a `HoldingsReadError`, never an empty list. Server-only; not re-exported from the package root.
 */
export {
  CIP56_DECIMALS, HoldingsReadError, parseShareInstruments, readCip56Holdings, readHoldings,
  type Cip56Holding, type Holding, type HoldingsBody, type HoldingsInput, type ShareInstrument,
} from "./reader";
export { decimalToE12, effectiveMultiplierE12, exposureUsdE6, MULTIPLIER_SCALE, sharesE8, type ScaledUiAmountState } from "./scaled-amount";
