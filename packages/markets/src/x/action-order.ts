import type { DiagnosisKind, MarketId, Side } from "@agari/core/types";
import { parseStakeBase, windowShareAction, X_REFUSAL_DETAILS, type ActionPostResponse, type XRefusalCode } from "@agari/core/x";
import { marketsProvider } from "../provider";

/**
 * A Window as a share action, for the Blinks endpoint (C13a). The reference built an unsigned Solana transaction for a
 * stranger's wallet here; Solana Actions have no Canton counterpart, so the same `POST` now answers with a signed
 * Window share link (`@agari/core/x` `share-link.ts`) that opens the ticket on the web or in the app. Nothing is
 * placed, signed by a seat, sent to the ledger or journaled: the viewer confirms the call in the ticket, under their
 * own seat. A refusal carries the same public words an X reply would.
 */
export type ActionOrderResult =
  | { ok: true; response: ActionPostResponse }
  | { ok: false; code: XRefusalCode; message: string; status: number };

const refuse = (code: XRefusalCode, status: number): ActionOrderResult => ({ ok: false, code, message: X_REFUSAL_DETAILS[code], status });

/** Every diagnosis kind a refusal can carry, as one of the public codes. */
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
  side: Side;
  /** The amount the viewer typed into the card, as text. */
  stakeText: string | null;
  /** The public origin the link opens on, without a trailing slash. */
  origin: string;
  /** The share key (server-only: `shareKeyFrom` over the web's secret); null when the host has none. */
  key: Uint8Array | null;
}

/** The guard every caller gets: a refusal, never a throw. A card client shows this text to a stranger. */
export async function buildWindowShareAction(input: ActionOrderInput): Promise<ActionOrderResult> {
  if (!input.key) return refuse("not-deployed", 503);
  const reading = await marketsProvider.getMarket(input.marketId);
  if (!reading.ok) return refuse("market-data-unavailable", 503);
  if (!reading.value) return refuse("no-window", 404);
  const stakeBase = parseStakeBase(input.stakeText, reading.value.decimals);
  if (stakeBase === null) return { ok: false, code: "instruction-invalid", message: "Enter an amount of credits.", status: 400 };
  const built = windowShareAction({ market: reading.value, side: input.side, stakeBase, origin: input.origin, key: input.key, nowMs: marketsProvider.nowMs() });
  return built.ok ? { ok: true, response: built.response } : { ok: false, code: built.code, message: built.message, status: 400 };
}
