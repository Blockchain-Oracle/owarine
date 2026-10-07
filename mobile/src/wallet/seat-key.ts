import { SEAT_KEY_BYTES } from "@owarine/markets/sessions/mobile";

/**
 * Making the phone's seat key, apart from where it is kept (`seat-key-store.ts`, the Keychain), so the same code runs
 * under vitest against the server's own verifier (`seat-key.test.ts`, plan iOS step 1: `seat.ts` signing parity).
 */
const SEED_BYTES = 32;
/** RFC 8410 PKCS#8 wrapper of a raw Ed25519 seed (the same 16 bytes markets' `ed25519.ts` uses). */
const PKCS8_ED25519_PREFIX = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * A fresh seat key: 64 bytes, `seed ‖ public key`. The seed comes from `crypto.getRandomValues`
 * (react-native-quick-crypto on the phone, installed by `polyfills.ts`). Its public key comes from the same WebCrypto:
 * the seed is imported once as an *extractable* PKCS#8 key only to read the JWK's `x` (the raw public key), then
 * dropped. quick-crypto 1.1.7 supports Ed25519 PKCS#8 import and JWK export (`src/subtle.ts` `exportKeyJWK`), so no
 * extra curve library ships in the app. Signing never uses this key: `seatSession` re-imports the seed non-extractable.
 */
export async function newSeatKey(): Promise<Uint8Array> {
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
