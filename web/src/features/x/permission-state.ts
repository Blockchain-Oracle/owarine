import type { Reading } from "@owarine/core/schemas";
import type { VaultGrant } from "@owarine/core/vault";
import { xPermissionState, type XPermissionState } from "@owarine/core/x";

export interface PermissionInput {
  snapshot: Reading<unknown> | null;
  /** The snapshot is ok, fresh and carries a vault. */
  readable: boolean;
  /** A readable snapshot has been seen on this screen before. */
  everRead: boolean;
  /** A saved update the page cannot parse, and the parsed one. */
  saved: string | null;
  pendingUpdate: unknown;
  current: VaultGrant | null;
  executor: string | null;
  nowSec: number;
}

/**
 * The X permission's state for the panel. On a cold load the first vault read can go out before the seat's key has
 * signed its read header, and our route answers it 401 (`signer-required`); the next read, a second later, succeeds.
 * Until the seat has been read once, that answer is still "checking" (the reference's loading state, "Checking X
 * trading…"), never "X trading status unavailable" for a second (C8g's noted flash, fixed in C8i). Any other failure,
 * or a 401 after a good read, is unavailable as before.
 */
export function xPermissionOf(i: PermissionInput): XPermissionState {
  if (!i.snapshot) return "checking";
  if (!i.snapshot.ok && i.snapshot.error.kind === "signer-required" && !i.everRead) return "checking";
  if (!i.readable || (i.saved && !i.pendingUpdate)) return "unavailable";
  if (i.pendingUpdate) return "update";
  return xPermissionState(i.current, i.executor, i.nowSec);
}
