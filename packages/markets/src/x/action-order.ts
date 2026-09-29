import type { Address, DiagnosisKind, MarketId, Side } from "@agari/core/types";
import { X_REFUSAL_DETAILS, type XRefusalCode } from "@agari/core/x";

/**
 * A Window as a share action, for the Blinks endpoint (C13). The reference built an unsigned Solana transaction for a
 * stranger's wallet; Solana Actions have no Canton counterpart, so C13 re-points these URLs at a signed Window share
 * link. Until then every request refuses with the public `not-deployed` code: nothing is built, signed, sent or
 * journaled, and a stranger reads the same words the app and an X reply would.
 */
export type ActionOrderResult =
  | { ok: true; transaction: string; message: string }
  | { ok: false; code: XRefusalCode; message: string };

const refuse = (code: XRefusalCode): ActionOrderResult => ({ ok: false, code, message: X_REFUSAL_DETAILS[code] });

/** Every diagnosis kind a refusal can carry, as one of the public codes (kept for C13's share-link handoff). */
export const PUBLIC_CODE: Partial<Record<DiagnosisKind, XRefusalCode>> = {
  "insufficient-collateral": "insufficient-funds",
  "out-of-gas": "insufficient-funds",
  "market-not-trading": "window-entry-closed",
  "order-expired": "window-entry-closed",
  "pre-open-taker": "window-entry-closed",
  "no-liquidity": "no-liquidity",
  "thin-book": "no-liquidity",
  "post-only-would-cross": "no-liquidity",
  "too-many-resting": "position-limit",
  "reserve-cap": "no-liquidity",
  "below-min-quantity": "instruction-invalid",
  "outside-band": "price-limit",
  "invalid-price": "price-limit",
  requote: "price-moved",
  "daily-stop": "execution-paused",
  "not-deployed": "not-deployed",
  "indexer-down": "market-data-unavailable",
  "rpc-down": "market-data-unavailable",
  "contract-revert": "execution-unavailable",
};

export interface ActionOrderInput {
  marketId: MarketId;
  wallet: Address;
  side: Side;
  stakeBase: bigint;
}

/** The guard every caller gets: a refusal, never a throw. A blink client shows this text to a stranger. */
export async function buildWindowActionTransaction(_input: ActionOrderInput): Promise<ActionOrderResult> {
  return refuse(PUBLIC_CODE["not-deployed"] ?? "execution-unavailable");
}
