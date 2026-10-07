import type { Address } from "@owarine/core/types";

/**
 * The seat's signing key, as markets holds it (plan §2): an ed25519 key whose base58 public key is the app's `Address`.
 * It signs raw UTF-8 text for the signed routes (takes, room, strategies, X bind, push) and, from C4, the seat header
 * the iOS app sends. It never signs a ledger command: a seat's commands are submitted by our route handlers acting as
 * the seat's leased party. Opaque on purpose, so the web's WebCrypto key and the phone's Keychain seed both fit.
 */
export interface SeatSigner {
  readonly address: Address;
  /** ed25519 over exactly these bytes; returns the 64 signature bytes. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}
