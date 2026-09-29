/**
 * Private mode on Canton is the private bucket of `VenueCash` (C8): the route and its promise stay, the Solana slot
 * machinery is gone. Until it lands every read is empty or not-live and every write refuses (D-015); the claim
 * verifier, the slot-key derivation and the public wording are pure and stay.
 */
export { signPrivateClaim, verifyPrivateClaim, type DeskClaimKey } from "./claim";
export { cashOutPrivateBet, ClaimRefusedError } from "./desk-cashout";
export { createDeskClient, type DeskClient, type DeskClientConfig } from "./desk-client";
export { publicReason } from "./desk-errors";
export { deskHealth } from "./desk-health";
export { openPrivateBet, type DeskOpenInput } from "./desk-open";
export { deriveSlotKeys, type SlotKeys } from "./keys";
export { getPrivateBudget, getPrivateDeskState, getPrivateSlot, sizePrivateForStake, toPrivateBudget } from "./reads";
export { submitPrivateTx } from "./writes";
