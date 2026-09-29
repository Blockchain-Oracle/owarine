import { SEAT_KEY_BYTES, seatSession } from "@agari/markets/sessions/mobile";
import * as SecureStore from "expo-secure-store";
import { SEAT_KEY } from "~/lib/keys";

/**
 * The phone's seat key: 64 bytes, the 32-byte ed25519 seed followed by its 32-byte public key (the layout
 * `seatSession` takes). This device only, while unlocked: never synced to iCloud Keychain or restored from a backup
 * onto another phone, and no `requireAuthentication`, so a signature never waits on Face ID.
 *
 * Why the public half is stored: markets imports the seed non-extractable and never exports it, so it cannot derive
 * the public key later. It is derived once, here, at creation (below), and checked by `seatSession`'s sign-and-verify
 * before the key is written.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const SEED_BYTES = 32;
/** RFC 8410 PKCS#8 wrapper of a raw Ed25519 seed (the same 16 bytes markets' `ed25519.ts` uses). */
const PKCS8_ED25519_PREFIX = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * A fresh seat key. The seed comes from `crypto.getRandomValues` (react-native-quick-crypto, installed by
 * `polyfills.ts`). Its public key comes from the same WebCrypto: the seed is imported once as an *extractable* PKCS#8
 * key only to read the JWK's `x` (the raw public key), then dropped. quick-crypto 1.1.7 supports Ed25519 PKCS#8 import
 * and JWK export (`src/subtle.ts` `exportKeyJWK`), so no extra curve library ships in the app. Signing never uses this
 * key: `seatSession` re-imports the seed non-extractable.
 */
async function newSeatKey(): Promise<Uint8Array> {
  const seed = crypto.getRandomValues(new Uint8Array(SEED_BYTES));
  const pkcs8 = Uint8Array.from([...PKCS8_ED25519_PREFIX, ...seed]);
  try {
    const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
    const { x } = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
    const publicKey = x ? fromBase64Url(x) : null;
    if (publicKey?.length !== SEED_BYTES) throw new Error("this phone's crypto did not return the seat's public key");
    const secretKey = new Uint8Array(SEAT_KEY_BYTES);
    secretKey.set(seed, 0);
    secretKey.set(publicKey, SEED_BYTES);
    return secretKey;
  } finally {
    pkcs8.fill(0);
    seed.fill(0);
  }
}

/** This phone's seat key, or null when none was taken yet (or a stored value is not a seat key). */
export async function loadSeatKey(): Promise<Uint8Array | null> {
  const stored = await SecureStore.getItemAsync(SEAT_KEY, OPTIONS);
  if (!stored || stored.length !== SEAT_KEY_BYTES * 2) return null;
  return fromHex(stored);
}

/** Creates the seat key, proves it signs (`seatSession` verifies the public half), then keeps it on this phone. */
export async function createSeatKey(): Promise<Uint8Array> {
  const secretKey = await newSeatKey();
  await seatSession(secretKey);
  await SecureStore.setItemAsync(SEAT_KEY, toHex(secretKey), OPTIONS);
  return secretKey;
}

/** Forgets the seat key. The next seat is a new key: nothing of the old one can be recovered on this phone. */
export const resetSeatKey = () => SecureStore.deleteItemAsync(SEAT_KEY, OPTIONS);
