import { SEAT_KEY_BYTES, seatSession } from "@agari/markets/sessions/mobile";
import * as SecureStore from "expo-secure-store";
import { SEAT_KEY } from "~/lib/keys";
import { fromHex, newSeatKey, toHex } from "./seat-key";

/**
 * The phone's seat key: 64 bytes, the 32-byte ed25519 seed followed by its 32-byte public key (the layout
 * `seatSession` takes). This device only, while unlocked: never synced to iCloud Keychain or restored from a backup
 * onto another phone, and no `requireAuthentication`, so a signature never waits on Face ID.
 *
 * Why the public half is stored: markets imports the seed non-extractable and never exports it, so it cannot derive
 * the public key later. It is derived once, at creation (`newSeatKey`, ./seat-key.ts), and checked by `seatSession`'s
 * sign-and-verify before the key is written.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

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
