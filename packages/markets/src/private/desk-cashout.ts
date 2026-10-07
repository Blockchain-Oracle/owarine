import type { PrivateCashoutResult, PrivateClaim } from "@owarine/core/private";
import type { Signature } from "@owarine/core/types";
import type { DeskClient } from "./desk-client";
import { PRIVATE_NOT_LIVE_WORDS } from "./reads";

export class ClaimRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimRefusedError";
  }
}

/** The way home refuses by name until the private bucket lands (C8): there is no slot on this network to pay from. */
export async function cashOutPrivateBet(_desk: DeskClient, _claim: PrivateClaim, _signature: Signature): Promise<PrivateCashoutResult> {
  throw new ClaimRefusedError(PRIVATE_NOT_LIVE_WORDS);
}
