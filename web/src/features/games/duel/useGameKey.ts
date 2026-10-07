"use client";

import type { Address, Signature } from "@owarine/core/types";
import { useMemo } from "react";
import { signText, useOwnerWallet, useWalletSession } from "@/lib/wallet-session";

/**
 * The duel's key on Canton is the seat key itself.
 *
 * On Solana a duel needed a second key: the entry named it as the seat's on-chain agent and it signed every pick, so the
 * wallet was never prompted per card. Canton has no agent to name: every pick is the seat's own command, submitted by
 * our server as the leased seat's party, and the seat key already signs without a prompt. So the one identity a duel
 * needs before anything touches the ledger — the room's credential (`useRoomToken`) — is signed by the seat key, and the
 * room's `wallet` and `key` are the same address.
 *
 * The exported names are the reference's (the phone shims this file by path, `mobile/src/web-shims/game-key.ts`). Nothing
 * is stored: the seat key lives with the seat (non-extractable, D-066), so there is no record to load or forget.
 */

export interface StoredGameKey {
  address: Address;
  /** Always empty on Canton: the seat key never leaves its store. */
  secretKey: string;
  createdAtMs: number;
}

export interface GameKey {
  address: Address;
  /** Empty on Canton: the seat key is non-extractable, and nothing signs with raw bytes here. */
  secretKey: Uint8Array;
  /** Signs as the seat — a message, never a command, and never a prompt. Returns the base58 signature. */
  signMessage: (message: string) => Promise<Signature>;
}

/** Nothing is stored per wallet on Canton: the seat is the key. */
export async function loadGameKey(_owner: Address): Promise<StoredGameKey | null> {
  return null;
}

/** Nothing to forget: resetting the seat is the account modal's job, not the duel's. */
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
