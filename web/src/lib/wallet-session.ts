"use client";

import { messageBytes } from "@owarine/core/auth";
import { encodeBase58, toSignature, type Address, type Signature } from "@owarine/core/types";
import type { WalletSession as MarketsWalletSession } from "@owarine/markets/react";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";

export interface WalletSession {
  address: Address | null;
  isConnected: boolean;
  /** A held seat is being read back from IndexedDB after hydration. False on the server, during hydration and for a browser with no seat. */
  isConnecting: boolean;
  /**
   * Always equal to `isConnected`. The network is the app's participant, not the seat's: a seat key cannot sit on the
   * "wrong chain" for a signature, so there is no switch to offer (D-120's reasoning, carried to Canton).
   */
  isRightChain: boolean;
  /** Kept for the surfaces that disable a control while a switch runs; there is never a switch on Canton. */
  switching: false;
  /** A user-initiated "Take a seat" is in flight. */
  connecting: boolean;
  /** Opens the seat modal ("Take a seat": the guest seat, plan §F). */
  connect(): void;
  /** Opens the account modal (avatar, seat address, Copy Address, Reset Seat): Masayume's RainbowKit `openAccountModal`. */
  openAccount(): void;
  disconnect(): Promise<void>;
}

/** The sole wallet surface in product code: session only, never chain reads (AD-14). Base58 is case-sensitive: never re-case `address`. */
export function useWalletSession(): WalletSession {
  const shell = useWalletShell();
  const isConnected = shell.status === "ready" && shell.address !== null && shell.wallet !== null;
  return {
    address: isConnected ? shell.address : null,
    isConnected,
    isConnecting: shell.status === "restoring",
    isRightChain: isConnected,
    switching: false,
    connecting: shell.connecting,
    connect: shell.openPicker,
    openAccount: shell.openAccount,
    disconnect: shell.disconnect,
  };
}

/** The held seat (the D-014 seam), or null: what owner-signed flows (signed texts) use. */
export function useOwnerWallet(): MarketsWalletSession | null {
  const shell = useWalletShell();
  return shell.status === "ready" ? shell.wallet : null;
}

/**
 * Signs one of Owarine's texts (`@owarine/core` builders: faucet, X link, duel room, private desk) and returns the base58
 * signature the server verifies with `verifySignedMessage`. The seat key signs exactly the UTF-8 bytes (D-012).
 */
export async function signText(wallet: MarketsWalletSession, text: string): Promise<Signature> {
  return toSignature(encodeBase58(await wallet.signMessage(messageBytes(text))));
}
