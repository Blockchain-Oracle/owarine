import type { Address } from "@agari/core/types";
import { keypairAddress, SECRET_KEY_BYTES } from "./keypair";
import type { SeatSigner } from "./seat-signer";

/**
 * ed25519 through WebCrypto (browsers, Node ≥ 22, and the phone's Hermes via `react-native-quick-crypto`), with no
 * Solana SDK in the path. Private keys are imported non-extractable and never exported.
 */

/** RFC 8410 PKCS#8 wrapper of a raw 32-byte Ed25519 seed. */
const PKCS8_ED25519_PREFIX = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];
const ED25519 = { name: "Ed25519" } as const;
const PROBE = new TextEncoder().encode("seat key check");

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto is not available in this runtime");
  return s;
};

/** A private key's signer: the 64 signature bytes over exactly `message`. */
function signerOf(address: Address, privateKey: CryptoKey): SeatSigner {
  return { address, signMessage: async (message) => new Uint8Array(await subtle().sign(ED25519, privateKey, Uint8Array.from(message))) };
}

/**
 * A 64-byte keypair (`seed ‖ public key`, the layout `keypair.ts` parses) as a signer. The seed is imported
 * non-extractable, and the public half is checked against it by one sign-and-verify before anything else signs.
 */
export async function signerFromSecretKey(secretKey: Uint8Array): Promise<SeatSigner> {
  if (secretKey.length !== SECRET_KEY_BYTES) throw new Error(`expected a ${SECRET_KEY_BYTES}-byte keypair (seed ‖ public key)`);
  const pkcs8 = Uint8Array.from([...PKCS8_ED25519_PREFIX, ...secretKey.subarray(0, 32)]);
  const privateKey = await subtle().importKey("pkcs8", pkcs8, ED25519, false, ["sign"]);
  pkcs8.fill(0);
  const publicKey = await subtle().importKey("raw", Uint8Array.from(secretKey.subarray(32)), ED25519, false, ["verify"]);
  const probe = await subtle().sign(ED25519, privateKey, PROBE);
  if (!(await subtle().verify(ED25519, publicKey, probe, PROBE))) throw new Error("the keypair's public half does not match its seed");
  return signerOf(keypairAddress(secretKey), privateKey);
}

/** A WebCrypto key pair the caller already holds (the web's non-extractable IndexedDB key), under its known address. */
export function signerFromKeyPair(address: Address, keyPair: { privateKey: CryptoKey }): SeatSigner {
  return signerOf(address, keyPair.privateKey);
}
