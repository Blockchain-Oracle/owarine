import type { Address } from "@owarine/core/types";
import { signerFromSecretKey } from "../ed25519";
import { SECRET_KEY_BYTES } from "../keypair";

/** The seat key's length on a phone: the 32-byte ed25519 seed followed by its 32-byte public key. */
export const SEAT_KEY_BYTES = SECRET_KEY_BYTES;

/** What the phone's seat hands to markets: the base58 seat key and its text signature. */
export interface SeatSession {
  address: Address;
  /** ed25519 over exactly these bytes; returns the 64 signature bytes. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

/**
 * The phone's seat (plan §2, iOS section): the key the app keeps in the Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`),
 * imported non-extractable through WebCrypto Ed25519 (`react-native-quick-crypto` on Hermes) each time it is needed,
 * with no Solana SDK in the path. Its base58 public key is the app's `Address`; the server maps it to the leased party.
 */
export async function seatSession(secretKey: Uint8Array): Promise<SeatSession> {
  const signer = await signerFromSecretKey(secretKey);
  return { address: signer.address, signMessage: (message) => signer.signMessage(message) };
}
