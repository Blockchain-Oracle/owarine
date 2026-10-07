"use client";

import { encodeBase58, isAddress, toAddress, type Address } from "@owarine/core/types";
import { signerFromKeyPair, type SeatSigner } from "@owarine/markets/sessions";
import { del, get, set } from "idb-keyval";

/**
 * The browser's seat key (plan §2, D-066 carried over): an ed25519 key made by the runtime's own WebCrypto, generated
 * non-extractable, and kept in IndexedDB as the `CryptoKeyPair` itself. Structured clone keeps `[[extractable]] =
 * false`, so the private half never exists as bytes in the page; only the public half is ever exported, and its base58
 * is the app's `Address`. It signs raw UTF-8 text for the signed routes; it never signs a ledger command (our route
 * handlers submit as the seat's leased party, from C4).
 */
export interface StoredSeat {
  v: 1;
  address: Address;
  keyPair: CryptoKeyPair;
  createdAtMs: number;
}

/** IndexedDB record of the seat key. */
const SEAT_DB_KEY = "owarine.seat.key";
/**
 * localStorage marker that a seat exists, read synchronously after hydration so a returning visitor shows "restoring"
 * for the moment IndexedDB takes, and a first-time visitor is ready at once (the wallet plugin's `owarine.wallet` role).
 */
export const SEAT_STORAGE_KEY = "owarine.seat";

const ED25519 = { name: "Ed25519" } as const;

function isStoredSeat(value: unknown): value is StoredSeat {
  const v = value as Partial<StoredSeat> | null;
  if (!v || v.v !== 1 || !isAddress(v.address) || typeof v.createdAtMs !== "number") return false;
  const pair = v.keyPair as { privateKey?: unknown; publicKey?: unknown } | undefined;
  const privateKey = pair?.privateKey;
  return typeof CryptoKey !== "undefined" && privateKey instanceof CryptoKey && pair?.publicKey instanceof CryptoKey && !privateKey.extractable;
}

export function hasSeatMarker(): boolean {
  try {
    return window.localStorage.getItem(SEAT_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function writeMarker(address: Address | null): void {
  try {
    if (address === null) window.localStorage.removeItem(SEAT_STORAGE_KEY);
    else window.localStorage.setItem(SEAT_STORAGE_KEY, address);
  } catch {
    // Blocked storage only costs the short "restoring" state on the next visit.
  }
}

/** The seat this browser already holds, or null (none, corrupted, extractable, or storage unavailable). */
export async function loadSeat(): Promise<StoredSeat | null> {
  try {
    const stored = await get<unknown>(SEAT_DB_KEY);
    if (isStoredSeat(stored)) return stored;
  } catch {
    // IndexedDB unavailable (private mode on some browsers): no seat survives, one can still be taken for this page.
  }
  writeMarker(null);
  return null;
}

/** Makes a fresh seat key and keeps it; a storage failure still returns the seat, which then lasts for this page only. */
export async function takeSeat(nowMs: number = Date.now()): Promise<StoredSeat> {
  const keyPair = (await crypto.subtle.generateKey(ED25519, false, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const seat: StoredSeat = { v: 1, address: toAddress(encodeBase58(publicKey)), keyPair, createdAtMs: nowMs };
  try {
    await set(SEAT_DB_KEY, seat);
    writeMarker(seat.address);
  } catch {
    writeMarker(null);
  }
  return seat;
}

/** Forgets the seat key for good: the next "Take a seat" makes a new address. */
export async function resetSeat(): Promise<void> {
  writeMarker(null);
  try {
    await del(SEAT_DB_KEY);
  } catch {
    // nothing to forget where storage never worked
  }
}

export function seatSigner(seat: StoredSeat): SeatSigner {
  return signerFromKeyPair(seat.address, seat.keyPair);
}
