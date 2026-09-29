import type { Address } from "@agari/core";
import type { SeatSigner } from "../sessions/seat-signer";

/**
 * The one wallet seam the web and the phone hand to markets (D-014, re-meant for Canton).
 *
 * The connected account is a seat (plan §2): `address` is the seat key's base58 public key, and `signMessage` is its
 * ed25519 text signature. `signer` is the seat's opaque signer when the island exposes one; it is optional because no
 * ledger command is ever signed in the browser (our route handlers submit as the seat's party).
 */
export interface WalletSession {
  address: Address;
  /** The seat's opaque signer, when the island hands one over. */
  signer?: SeatSigner;
  /** ed25519 over exactly these bytes; returns the 64 signature bytes. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}
