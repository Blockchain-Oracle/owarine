import type { Address, Signature } from "@agari/core/types";
import { useMemo } from "react";
import { signText, useOwnerWallet, useWalletSession } from "@/lib/wallet-session";

/**
 * Stands in for web/src/features/games/duel/useGameKey.ts (same exports, same behaviour). On Canton the duel's key is
 * the seat key itself: the phone's seat (its Keychain seed, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) signs the room's
 * credential through the same wallet session the rest of the app signs with, and every pick is the seat's own command
 * sent by the server as its leased party. There is no second keypair, so nothing goes in SecureStore and there is
 * nothing to load or forget.
 */

export interface StoredGameKey {
  address: Address;
  /** Always empty on Canton: the seat key never leaves its store. */
  secretKey: string;
  createdAtMs: number;
}

export interface GameKey {
  address: Address;
  /** Empty on Canton: the seat signs, and nothing signs with raw bytes here. */
  secretKey: Uint8Array;
  /** Signs as the seat — a message, never a command, and never a prompt. Returns the base58 signature. */
  signMessage: (message: string) => Promise<Signature>;
}

/** Nothing is stored per wallet on Canton: the seat is the key. */
export async function loadGameKey(_owner: Address): Promise<StoredGameKey | null> {
  return null;
}

/** Nothing to forget: resetting the seat is the account screen's job, not the duel's. */
export async function forgetGameKey(_owner: Address): Promise<void> {}

const EMPTY = new Uint8Array(0);

export function useGameKey(): GameKey | null {
  const { address } = useWalletSession();
  const wallet = useOwnerWallet();
  return useMemo(() => {
    if (!address || !wallet) return null;
    return { address, secretKey: EMPTY, signMessage: (message: string) => signText(wallet, message) };
  }, [address, wallet]);
}
