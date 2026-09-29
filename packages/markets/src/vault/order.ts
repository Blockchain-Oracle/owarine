import type { OrderOutcome, OrderRequest, OrderRoute, PhaseListener } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import { submitSeatOrder, type SeatLaneDeps } from "../submitter/seat-lane";

/**
 * A call placed "through the trading balance" (C8f). On Canton the seat's cash IS the balance, so the `vault` route is
 * the seat's own order. A `vault-grant` route is an agent's (the strategy runner, the X executor): it acts through the
 * owner's `AgentGrant` from ops (`@agari/markets/ops/agents` executor), never from a seat's session.
 */
export async function submitVaultOrder(ctx: unknown, request: OrderRequest, route: OrderRoute, onPhase?: PhaseListener): Promise<OrderOutcome> {
  if (route.kind === "vault-grant") return { status: "refused", diagnosis: diagnosis("grant-refused", "an agent places through the owner's grant from its own process, not from a seat session") };
  if (typeof ctx !== "object" || ctx === null || !("journal" in ctx)) return { status: "refused", diagnosis: diagnosis("signer-required", "no seat lane to place with") };
  return submitSeatOrder(ctx as SeatLaneDeps, { ...request, route: { kind: "wallet" } }, onPhase);
}
