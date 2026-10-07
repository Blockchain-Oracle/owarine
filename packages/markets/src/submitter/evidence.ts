import type { Address, MarketId, Signature } from "@owarine/core/types";
import { indexRows, type ActionRow, type FillRow } from "../provider/index-api";
import type { WriteRpc } from "./write-rpc";

/**
 * What a write lane asks the record about when the ledger's own state no longer says it (first-call.md §3.2, §3.4):
 * whether a journaled order that never got an update id filled anyway, and who claimed a position that is gone.
 */
export interface WriteEvidence {
  /** Any fill of the seat's on the Window at or after `sinceSec`; null when the projection can't be asked. */
  filledSince(wallet: Address, marketId: MarketId, sinceSec: number): Promise<boolean | null>;
  /** The update id of the claim that paid the seat's position on the Window. */
  redeemedBy(wallet: Address, marketId: MarketId, ledger: Address): Promise<Signature | null>;
}

/** Actions scanned for a Window's claim; a seat's newest first. */
const ACTIONS_PAGE = 200;

/**
 * The projection API (`/api/index/*`, through the runtime's `indexRows`). An unreachable or unconfigured projection
 * answers `null` for fills, never "nothing filled". The reference's chain fallback (the Ledger's recent history) has
 * no Canton counterpart until the adapter reads completions (C4), so a claim the projection hasn't seen answers null.
 */
export function indexEvidence(_rpc?: WriteRpc): WriteEvidence {
  return {
    async filledSince(wallet, marketId, sinceSec) {
      const rows = await indexRows<FillRow>(`wallet/${wallet}/fills`, { market: marketId, since: sinceSec, limit: 1 }).catch(() => null);
      return rows === null ? null : rows.length > 0;
    },
    async redeemedBy(wallet, marketId) {
      const rows = await indexRows<ActionRow>(`wallet/${wallet}/actions`, { limit: ACTIONS_PAGE }).catch(() => null);
      const row = rows?.find((r) => r.name === "Redeemed" && r.market === (marketId as string));
      return row ? (row.signature as Signature) : null;
    },
  };
}
