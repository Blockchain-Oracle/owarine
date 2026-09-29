import type { OrderOutcome, OrderRequest, OrderRoute, PhaseListener } from "@agari/core/ports";
import { refusedFor } from "../stub/product";
import { VAULT_NOT_LIVE } from "./deployment";

/** A call placed through the trading balance or a grant refuses before anything is journaled or signed until C7a. */
export async function submitVaultOrder(_ctx: unknown, _request: OrderRequest, _route: OrderRoute, _onPhase?: PhaseListener): Promise<OrderOutcome> {
  return refusedFor(VAULT_NOT_LIVE);
}
