import { CLUSTER_ID, DEFAULT_CLUSTER } from "@owarine/core/constants";
import type { PrivateStatus } from "@owarine/core/private";
import type { DeskClient } from "./desk-client";
import { PRIVATE_NOT_LIVE_WORDS } from "./reads";

/** Whether the private route can run right now, and every reason it cannot, so the control never silently does nothing. */
export async function deskHealth(desk: DeskClient | null): Promise<PrivateStatus> {
  const reasons = [PRIVATE_NOT_LIVE_WORDS];
  if (!desk) reasons.push("no desk key is configured on this deployment (PRIVATE_DESK_PRIVATE_KEY)");
  return { ready: false, reasons, mode: "desk-signed-slot", desk: desk?.address ?? null, contract: null, chainId: desk?.chainId ?? CLUSTER_ID[DEFAULT_CLUSTER], minStakeBase: null, maxStakeBase: null, paused: false };
}
